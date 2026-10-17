import type { BioRedRepo } from "../data/repo.ts";
import type { CommunityPostRecord } from "../data/types.ts";
import { notFound } from "../lib/errors.ts";
import { serializePost } from "../serializers/dto.ts";
import {
  createChallengeSchema,
  createPostSchema,
  likeSchema,
  parseOrThrow,
} from "../schemas/validation.ts";
import type { RouteContext } from "../routes/router.ts";
import { json } from "../middlewares/errorHandler.ts";

/**
 * Feed comunitario y Retos Barriales.
 * Devuelve los posts y los retos ya separados, tal como los pinta la UI mínima.
 */
export function communityController(repo: BioRedRepo) {
  return {
    /** `GET /community/feed?userId=...&nodeId=...&limit=20` */
    async feed(ctx: RouteContext): Promise<Response> {
      const nodeId = ctx.query.get("nodeId");
      const limitRaw = Number(ctx.query.get("limit") ?? "30");
      const limit = Number.isFinite(limitRaw)
        ? Math.min(60, Math.max(1, Math.trunc(limitRaw)))
        : 30;

      const [posts, nodes] = await Promise.all([repo.listPosts(), repo.listNodes()]);
      const nodeById = new Map(nodes.map((node) => [node.id, node]));

      const scoped = posts.filter((post) => (nodeId ? post.nodeId === nodeId : true));
      const serialize = (post: CommunityPostRecord) =>
        serializePost(post, post.nodeId ? nodeById.get(post.nodeId) : null);

      const activities = scoped.filter((post) => !post.isChallenge).slice(0, limit);
      const challenges = scoped.filter((post) => post.isChallenge);

      return json({
        feed: activities.map(serialize),
        challenges: challenges.map((challenge) => ({
          ...serialize(challenge),
          title: challenge.content,
          coordinatorName: challenge.authorName,
          coordinatorAvatar: challenge.authorAvatar,
          neighborhood: challenge.location,
          targetKg: challenge.challengeGoalKg,
          currentKg: challenge.currentKg,
          participantsCount: challenge.participantsCount,
          coverImage: challenge.imageUrl,
        })),
        stats: {
          postsCount: activities.length,
          challengesCount: challenges.length,
          totalKgShared: round(scoped.reduce((acc, post) => acc + post.kgContributed, 0), 1),
        },
      });
    },

    /** `POST /community/posts` */
    async createPost(ctx: RouteContext): Promise<Response> {
      const input = parseOrThrow(createPostSchema, await ctx.body(), "POST /community/posts");

      const [user, node] = await Promise.all([
        repo.getUser(input.userId),
        input.nodeId ? repo.getNode(input.nodeId) : Promise.resolve(null),
      ]);
      if (!user) throw notFound("USER_NOT_FOUND", `Vecino ${input.userId} no encontrado.`);
      if (input.nodeId && !node) {
        throw notFound("NODE_NOT_FOUND", `Bio-Nodo ${input.nodeId} no encontrado.`);
      }

      const post: CommunityPostRecord = {
        id: `post-${crypto.randomUUID()}`,
        userId: user.id,
        nodeId: node?.id ?? null,
        authorName: user.name,
        authorRole: user.role === "BRIGADE" ? "Brigada Verde" : "Vecino de Managua",
        authorAvatar: user.avatarUrl,
        location: node ? `${node.district}, Managua` : `${user.district}, Managua`,
        content: input.content,
        imageUrl: input.imageUrl ?? null,
        kgContributed: input.kgContributed,
        likesCount: 0,
        commentsCount: 0,
        isChallenge: false,
        challengeGoalKg: null,
        currentKg: null,
        endDate: null,
        participantsCount: null,
        tag: null,
        verifiedBadge: input.kgContributed > 0,
        createdAt: new Date().toISOString(),
      };

      const created = await repo.createPost(post);
      return json({ post: serializePost(created, node) }, 201);
    },

    /** `POST /community/challenges` — apertura de un Reto Barrial. */
    async createChallenge(ctx: RouteContext): Promise<Response> {
      const input = parseOrThrow(
        createChallengeSchema,
        await ctx.body(),
        "POST /community/challenges",
      );

      const coordinator = await repo.getUser(input.coordinatorId);
      if (!coordinator) {
        throw notFound("USER_NOT_FOUND", `Coordinador ${input.coordinatorId} no encontrado.`);
      }

      const challenge: CommunityPostRecord = {
        id: `challenge-${crypto.randomUUID()}`,
        userId: coordinator.id,
        nodeId: null,
        authorName: input.coordinatorId === coordinator.id ? coordinator.name : coordinator.name,
        authorRole: "Coordinador de Reto",
        authorAvatar: coordinator.avatarUrl,
        location: input.neighborhood,
        content: input.title,
        imageUrl: input.coverImage ?? null,
        kgContributed: 0,
        likesCount: 0,
        commentsCount: 0,
        isChallenge: true,
        challengeGoalKg: input.challengeGoalKg,
        currentKg: 0,
        endDate: input.endDate,
        participantsCount: 1,
        tag: input.tag ?? "Reto Barrial",
        verifiedBadge: true,
        createdAt: new Date().toISOString(),
      };

      const created = await repo.createPost(challenge);
      return json({ challenge: serializePost(created) }, 201);
    },

    /** `POST /community/posts/:id/like` */
    async like(ctx: RouteContext): Promise<Response> {
      const input = parseOrThrow(
        likeSchema,
        await ctx.body(),
        `POST /community/posts/${ctx.params.id}/like`,
      );

      const post = await repo.likePost(ctx.params.id, input.delta);
      if (!post) throw notFound("POST_NOT_FOUND", `Publicación ${ctx.params.id} no encontrada.`);

      const node = post.nodeId ? await repo.getNode(post.nodeId) : null;
      return json({ post: serializePost(post, node) });
    },

    /** `GET /community/posts/:id` */
    async getPost(ctx: RouteContext): Promise<Response> {
      const posts = await repo.listPosts();
      const post = posts.find((candidate) => candidate.id === ctx.params.id);
      if (!post) throw notFound("POST_NOT_FOUND", `Publicación ${ctx.params.id} no encontrada.`);

      const node = post.nodeId ? await repo.getNode(post.nodeId) : null;
      return json({ post: serializePost(post, node) });
    },
  };
}

const round = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};
