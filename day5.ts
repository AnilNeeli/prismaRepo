import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['query']  // prints every SQL query to terminal
})

async function main() {
  // First seed some data
  await prisma.userBlog.createMany({
    data: [
      { email: 'user1@test.com', name: 'User 1'},
      { email: 'user2@test.com', name: 'User 2' },
      { email: 'user3@test.com', name: 'User 3' },
    ],
    skipDuplicates: true
  })

  // Create posts for each user
  const users = await prisma.userBlog.findMany()
  for (const user of users) {
    await prisma.post.create({
      data: {
        title: `Post by ${user.name}`,
        userId: user.id
      }
    })
  }

  // ❌ THIS IS N+1 — watch your terminal
  console.log('\n--- N+1 QUERY (BAD) ---')
  const posts = await prisma.post.findMany()        // 1 query
  for (const post of posts) {
    const user = await prisma.userBlog.findUnique({ // N queries — one per post
      where: { id: post.userId }
    })
    console.log(`${post.title} by ${user?.name}`)
  }
  // ✅ THIS IS THE FIX — 2 queries total
console.log('\n--- FIXED WITH INCLUDE ---')
const postsWithUsers = await prisma.post.findMany({
  include: { user: true }   // Prisma fetches all users in one extra query
})

for (const post of postsWithUsers) {
  console.log(`${post.title} by ${post.user.name}`)
}
//SELECT * FROM "Post"      -- query 1
//SELECT * FROM "UserBlog" WHERE id IN ('uuid-1', 'uuid-2', 'uuid-3')  -- query 2

// ❌ triple N+1
const postsTripel = await prisma.post.findMany()
for (const post of posts) {
  const user = await prisma.userBlog.findUnique({ where: { id: post.userId } })
  const comments = await prisma.comment.findMany({ where: { postId: post.id } })
  // each comment fetching its user = another N+1 inside this one
}

// ✅ fix with nested include
const postsPriplefix = await prisma.post.findMany({
  include: {
    user: { select: { name: true } },
    comments: {
      include: {
        user: { select: { name: true } }
      }
    }
  }
})

const totalPost=await prisma.post.findMany()
for (const post of totalPost) {
    const user = await prisma.userBlog.findUnique({ // N queries — one per post
      where: { id: post.userId }
    })
}

const totalPostInclude = await prisma.post.findMany({
  select: {
    title: true,          // only get title from Post
    user: {
      select: {
        name: true,       // only get name + email from User
        email: true
      }
    }
  }
})

const totalPostIncludeDeatil=await prisma.post.findMany(
    {    
        include:{user:true}
    }
)
console.log(totalPostInclude)

}



main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

