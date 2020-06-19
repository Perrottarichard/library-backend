const { ApolloServer, gql } = require('apollo-server')
require('dotenv').config()
const mongoose = require('mongoose')
const Author = require('./models/Author')
const Book = require('./models/Book')



mongoose.set('useFindAndModify', false)
const MONGO_URI = process.env.MONGO_URI
console.log('connecting to', MONGO_URI)

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true })
    .then(() => {
        console.log('connected to MongoDB')
    })
    .catch((error) => {
        console.log('error connecting to MongoDB', error.message)
    })


const typeDefs = gql`
type Mutation {
    addBook (
       title: String!
       author: String!
       published: Int!
       genres: [String!]! 
    ) : Book,

    editAuthor(
        name: String!
        setBornTo: Int!
    ) : Author
}

type Book {
    title: String!
    published: Int!
    author: Author!
    id: ID!
    genres: [String!]!
}
type Author {
    name: String!
    id: ID!
    born: Int
    bookCount: Int
}
  type Query {
      bookCount: Int!
      authorCount: Int!
      allBooks(author: String, genre: String): [Book!]!
      allAuthors: [Author!]!
  }
`

const resolvers = {
    Query: {
        bookCount: () => Book.collection.countDocuments(),
        authorCount: () => Author.collection.countDocuments(),
        allBooks: (root, args) => {
            if (!args.author && !args.genre) {
                return Book.find({}).populate('author')
            }
            if (args.author) {
                let arr = []
                books.filter(b => b.author === args.author ? arr.push(b) : null)
                return arr
            }
            if (args.genre) {
                let arr = []
                books.filter(b => b.genres.includes(args.genre) ? arr.push(b) : null)
                return arr
            }

        },
        allAuthors: () => Author.find({})
    },
    Author: {
        bookCount: (root) => {
            let count = books.filter(b => b.author === root.name)
            return count.length
        }
    },
    Mutation: {
        addBook: (root, args) => {
            const book = new Book({ ...args })
            return book.save()
        },
        editAuthor: async (root, args) => {
            let matchedAuthor = await Author.findOne({ name: args.name })
            matchedAuthor.born = args.setBornTo
            return matchedAuthor.save()
        }
    }
}

const server = new ApolloServer({
    typeDefs,
    resolvers,
})

server.listen().then(({ url }) => {
    console.log(`Server ready at ${url}`)
})