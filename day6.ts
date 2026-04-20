import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['query']  // prints every SQL query to terminal
})

interface PaginationArgs {
  take: number
  cursor?: string  // id of last item from previous page
}

async function getPaginatedPosts({ take, cursor }: PaginationArgs) {
  const posts = await prisma.post.findMany({
    take,
    skip: cursor ? 1 : 0,           // skip cursor itself if provided
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      createdAt: true,
      user: { select: { name: true } }
    }
  })

  // Return posts + next cursor
  const nextCursor = posts.length === take
    ? posts[posts.length - 1].id   // more pages exist
    : null                          // last page — no more data

  return { posts, nextCursor }
}

async function  main(){
const page1 = await getPaginatedPosts({ take: 10 })
console.log('Page 1:', page1.posts.length)
console.log('Next cursor:', page1.nextCursor)

const page2 = await getPaginatedPosts({ take: 10, cursor: page1.nextCursor! })
console.log('Page 2:', page2.posts.length)
// Single field
await prisma.post.findMany({
  orderBy: { createdAt: 'desc' }  // 'asc' or 'desc'
})

// Multiple fields — primary sort first, tiebreaker second
await prisma.post.findMany({
  orderBy: [
    { published: 'desc' },   // published posts first
    { createdAt: 'desc' }    // then by newest
  ]
})

// Sort by relation field — order posts by author name
await prisma.post.findMany({
  orderBy: {
    user: { name: 'asc' }
  }
})

// Sort by aggregation — users with most posts first
await prisma.userBlog.findMany({
  orderBy: {
    posts: { _count: 'desc' }
  }
})

}