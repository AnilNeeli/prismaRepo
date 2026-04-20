import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['query']  // prints every SQL query to terminal
})
// Create a post and connect it to an existing user
await prisma.post.create({
  data: {
    title: 'My post',
    user: {
      connect: { id: 'user-123' }  // user already exists
    }
  }
})

// Same thing using raw FK — simpler
await prisma.post.create({
  data: {
    title: 'My post',
    userId: 'user-123'   // direct FK, no nested syntax needed
  }
})

// Create user + posts in one call
await prisma.userBlog.create({
  data: {
    email: 'anil@test.com',
    name: 'Anil',
    age: 25,
    posts: {
      create: [
        { title: 'Post 1' },
        { title: 'Post 2' },
      ]
    }
  }
})


// Tag a post — create tag if it doesn't exist, connect if it does
await prisma.post.update({
  where: { id: 'post-123' },
  data: {
    postTags: {
      connectOrCreate: {
        where: { postId_tagId: { postId: 'post-123', tagId: 'tag-456' } },
        create: {
          tag: { connectOrCreate: {
            where: { name: 'typescript' },
            create: { name: 'typescript' }
          }},
          taggedBy: 'anil@test.com'
        }
      }
    }
  }
})

// Remove a tag from a post — PostTag row deleted, Post and Tag survive
await prisma.post.update({
  where: { id: 'post-123' },
  data: {
    postTags: {
      delete: {
        postId_tagId: { postId: 'post-123', tagId: 'tag-456' }
      }
    }
  }
})

// disconnect on optional 1:1 relation — sets FK to null
await prisma.userBlog.update({
  where: { id: 'user-123' },
  data: {
    profile: { disconnect: true }  // sets profileId to null
  }
})

// Update post + update its author's name in one call
await prisma.post.update({
  where: { id: 'post-123' },
  data: {
    title: 'Updated title',
    user: {
      update: { name: 'New Name' }
    }
  }
})

// Update post, upsert its tags
await prisma.post.update({
  where: { id: 'post-123' },
  data: {
    title: 'Updated',
    postTags: {
      upsert: {
        where: { postId_tagId: { postId: 'post-123', tagId: 'tag-456' } },
        create: { tagId: 'tag-456', taggedBy: 'anil@test.com' },
        update: { taggedBy: 'anil@test.com' }
      }
    }
  }
})

// count — total number of records
const total = await prisma.post.count()
console.log('Total posts:', total)

// count with filter
const published = await prisma.post.count({
  where: { published: true }
})

// aggregate — sum, avg, min, max on numeric fields
const stats = await prisma.userBlog.aggregate({
  _count: { id: true },     // count of users
  _avg: { age: true },      // average age
  _min: { age: true },      // youngest
  _max: { age: true },      // oldest
  _sum: { age: true },      // sum of all ages
})
console.log('Avg age:', stats._avg.age)
console.log('Total users:', stats._count.id)

// Count posts per user
const postCounts = await prisma.post.groupBy({
  by: ['userId'],           // group by this field
  _count: { id: true },    // count posts in each group
  orderBy: { _count: { id: 'desc' } }  // most posts first
})

// postCounts looks like:
// [
//   { userId: 'uuid-1', _count: { id: 5 } },
//   { userId: 'uuid-2', _count: { id: 3 } },
// ]

// groupBy with having — filter groups (like SQL HAVING)
const activeUsers = await prisma.post.groupBy({
  by: ['userId'],
  _count: { id: true },
  having: {
    id: { _count: { gte: 2 } }  // only users with 2+ posts
  }
})

// where — filters individual rows BEFORE grouping
await prisma.post.groupBy({
  by: ['userId'],
  where: { published: true },   // only count published posts
  _count: { id: true }
})

// having — filters groups AFTER aggregation
await prisma.post.groupBy({
  by: ['userId'],
  _count: { id: true },
  having: {
    id: { _count: { gte: 3 } }  // only groups where count >= 3
  }
})


// Q1 — counts
const totalPost = await prisma.post.count()
const publishedPost = await prisma.post.count({ where: { published: true } })
const notPublishedPost = await prisma.post.count({ where: { published: false } })
console.log({ totalPost, publishedPost, notPublishedPost })

// Q2 — aggregate stats
const userStats = await prisma.userBlog.aggregate({
  _count: { id: true },
  _min: { age: true },
  _max: { age: true },
  _avg: { age: true }
})
console.log('Avg age:', userStats._avg.age)
console.log('Total users:', userStats._count.id)

// Q3 — groupBy post count per user
const userGroupCount = await prisma.post.groupBy({
  by: ['userId'],
  _count: { id: true },
  orderBy: { _count: { id: 'desc' } }
})
console.log('Post counts per user:', userGroupCount)

// Q4 — users with more than 1 post
const usersWithMorePosts = await prisma.post.groupBy({
  by: ['userId'],
  _count: { id: true },
  having: {
    id: { _count: { gte: 2 } }
  }
})
console.log('Users with 2+ posts:', usersWithMorePosts)

// Q5 — nested create
await prisma.userBlog.create({
  data: {
    email: 'newuser@test.com',
    name: 'Anil',
    age: 25,
    posts: {
      create: [
        { title: 'Post 1' },
        { title: 'Post 2' },
      ]
    }
  }
})
console.log('Created user with 2 posts')