import 'dotenv/config'
import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

const createPost = async (data: Prisma.PostCreateInput) => {
  return prisma.post.create({ data })
}

async function main() {

  // ── CREATE ──
  const user = await prisma.userBlog.create({
    data: {
      email: 'anil@test.com',
      name: 'Anil',
    }
  })
  console.log('Created user:', user.id)

  // Create user with nested post
  await prisma.userBlog.create({
    data: {
      email: 'test2@test.com',
      name: 'Test',
      posts: {
        create: {
          title: 'My first post',
          content: 'Hello world',
        }
      }
    }
  })

  // Fetch with include
  const userWithPost = await prisma.userBlog.findUnique({
    where: { email: 'test2@test.com' },
    include: { posts: true }
  })
  console.log('User with posts:', userWithPost?.posts.length)

  // Bulk insert tags
  await prisma.tag.createMany({
    data: [
      { name: 'typescript' },
      { name: 'prisma' },
      { name: 'nodejs' },
    ],
    skipDuplicates: true
  })

  // ── FIND ──
  const userOne = await prisma.user.findUnique({
    where: { email: 'anil@test.com' }
  })
  console.log('Found user:', userOne?.name)

  const latestPost = await prisma.post.findFirst({
    where: { published: true },
    orderBy: { createdAt: 'desc' }
  })
  console.log('Latest post:', latestPost?.title)

  const posts = await prisma.post.findMany({
    where: { published: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
    skip: 0,
  })
  console.log('Published posts:', posts.length)

  // findUnique by post id
  const postById = await prisma.post.findUnique({
    where: { id: 'post-123' }
  })

  // findMany by userId
  const publishedPosts = await prisma.post.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' }
  })
  console.log('User posts:', publishedPosts.length)

  // ── UPDATE ──
  const { count } = await prisma.post.updateMany({
    where: { userId: user.id },
    data: { published: false }
  })
  console.log(`Updated ${count} posts`)

  // ── UPSERT ──
  const tag = await prisma.tag.upsert({
    where: { name: 'typescript' },
    create: { name: 'typescript' },
    update: {}
  })
  console.log('Upserted tag:', tag.name)

  // ── DELETE ──
  await prisma.post.deleteMany({
    where: { userId: user.id }
  })
  console.log('Deleted user posts')

}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())