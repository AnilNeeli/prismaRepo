import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()



async function main() {

// equals (default — no operator needed)
await prisma.post.findMany({
  where: { published: true }
})

// not
await prisma.post.findMany({
  where: { published: { not: true } }
})

// in — match any value in array
await prisma.user.findMany({
  where: { email: { in: ['a@test.com', 'b@test.com'] } }
})

// notIn
await prisma.user.findMany({
  where: { email: { notIn: ['spam@test.com'] } }
})

// comparison — lt, lte, gt, gte
await prisma.userBlog.findMany({
  where: { age: { gte: 18, lte: 60 } }  // age between 18 and 60
})

// null check
await prisma.user.findMany({
  where: { name: null }       // name IS NULL
})
await prisma.user.findMany({
  where: { name: { not: null } }  // name IS NOT NULL
})


// contains — LIKE %value%
await prisma.user.findMany({
  where: { name: { contains: 'anil' } }
})

// case insensitive
await prisma.user.findMany({
  where: { name: { contains: 'anil', mode: 'insensitive' } }
})

// startsWith — LIKE value%
await prisma.post.findMany({
  where: { title: { startsWith: 'How to' } }
})

// endsWith — LIKE %value
await prisma.post.findMany({
  where: { title: { endsWith: '2025' } }
})

// AND — all conditions must match (default when you pass multiple fields)
await prisma.post.findMany({
  where: {
    published: true,
    userId: 'user-123'   // AND is implicit here
  }
})

// explicit AND
await prisma.post.findMany({
  where: {
    AND: [
      { published: true },
      { title: { contains: 'prisma' } }
    ]
  }
})

// OR — any condition matches
await prisma.user.findMany({
  where: {
    OR: [
      { email: { contains: '@gmail.com' } },
      { email: { contains: '@yahoo.com' } }
    ]
  }
})

// NOT — exclude matches
await prisma.post.findMany({
  where: {
    NOT: { published: true }  // same as published: false
  }
})

// Combining AND + OR
await prisma.post.findMany({
  where: {
    AND: [
      { published: true },
      {
        OR: [
          { title: { contains: 'prisma' } },
          { title: { contains: 'typescript' } }
        ]
      }
    ]
  }
})

// some — at least one child matches
// "users who have at least one published post"
await prisma.userBlog.findMany({
  where: {
    posts: { some: { published: true } }
  }
})

// every — all children match
// "users where ALL their posts are published"
await prisma.userBlog.findMany({
  where: {
    posts: { every: { published: true } }
  }
})

// none — no children match
// "users who have NO published posts"
await prisma.userBlog.findMany({
  where: {
    posts: { none: { published: true } }
  }
})

// is / isNot — filter by nullable relation
// "posts where the author has been deleted (userId is null)"
await prisma.post.findMany({
  where: {
    user: { is: null }  //for post schmea use is mandatoty t cann;t be null so the compiler is thrwong this erro
  }
})
const thirtyDaysAgo = new Date()
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

const users = await prisma.userBlog.findMany({
  where: {
    AND: [
      { isActive: true },
      {
        accounts: {
          some: {
            transactions: {
              some: {
                AND: [
                  { amount: { gte: 10000 } },
                  { status: 'COMPLETED' },
                  { createdAt: { gte: thirtyDaysAgo } }
                ]
              }
            }
          }
        }
      }
    ]
  },
  include: {
    accounts: {
      include: { transactions: true }
    }
  }
})

// Q1 — published posts with "prisma" in title
const publishedPostWithPrisma = await prisma.post.findMany({
  where: {
    AND: [
      { published: true },
      { title: { contains: 'prisma', mode: 'insensitive' } }
    ]
  }
})

// Q2 — users with at least one post
const usersWithAtLeastOnePost = await prisma.userBlog.findMany({
  where: {
    posts: { some: {} }  // some: {} = at least one exists
  }
})

// Q3 — users with no comments
const usersWithNoComments = await prisma.userBlog.findMany({
  where: {
    comments: { none: {} }  // none: {} = zero exist
  }
})

// Q4 — posts from last 7 days
const currentDate = new Date()
currentDate.setDate(currentDate.getDate() - 7)

const postsLast7Days = await prisma.post.findMany({
  where: { createdAt: { gte: currentDate } },  // gte not gt — include today
  orderBy: { createdAt: 'desc' }
})

// Q5 — published AND (title starts with How OR content has typescript)
const filteredPosts = await prisma.post.findMany({
  where: {
    AND: [
      { published: true },
      {
        OR: [
          { title: { startsWith: 'How' } },
          { content: { contains: 'typescript' } }
        ]
      }
    ]
  }
})


}