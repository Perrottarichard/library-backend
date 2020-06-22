const { ApolloServer, gql, UserInputError } = require('apollo-server')
require('dotenv').config()
const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')
const Author = require('./models/Author')
const Book = require('./models/Book')
const User = require('./models/User')



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
    
    addAuthor (
        name: String!
        born: Int
    ) : Author

    editAuthor(
        name: String!
        setBornTo: Int!
    ) : Author

    createUser(
        username: String!
        favoriteGenre: String!
      ): User

      login(
        username: String!
        password: String!
      ): Token
}
type User {
    username: String!
    favoriteGenre: String!
    id: ID!
  }
  
  type Token {
    value: String!
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
      hasAuthor(name: String!): Boolean!
      me: String!
  }
`

const resolvers = {
    Query: {
        me: (root, args, context) => context.currentUser,
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
        allAuthors: () => Author.find({}),
        hasAuthor: async (root, args) => {
            const result = await Author.exists({ name: args.name })
            if (result) {
                return true
            }
            else {
                return false
            }
        }
    },
    Author: {
        bookCount: (root) => {
            let count = Book.collection.countDocuments({ author: root.name })
            console.log(root.name, count.length)
            return count
        }
    },
    Mutation: {
        createUser: async (root, args) => {
            const user = new User({ username: args.username, favoriteGenre: args.favoriteGenre })
            try {
                return user.save()
            }
            catch (error) {
                throw new UserInputError(error.message, { invalidArgs: args })
            }
        },
        login: async (root, args) => {
            const user = await User.findOne({ username: args.username })
            if (!user || args.password !== 'secret') {
                throw new UserInputError("wrong credentials")
            }
            const userForToken = {
                username: user.username,
                id: user._id
            }
            return { value: jwt.sign(userForToken, process.env.JWT_SECRET) }
        },
        addBook: async (root, args) => {
            const book = new Book({ ...args })
            try {
                await book.save()
            } catch (error) {
                throw new UserInputError(error.message, { invalidArgs: args })
            }
            return book
        },
        // addAuthor: async (root, args) => {
        //     const author = new Author({ name: args.name })
        //     return author.save()
        // },
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
    context: async ({ req }) => {
        const auth = req ? req.headers.authorization : null
        if (auth && auth.toLowerCase().startsWith('bearer')) {
            const decodedToken = jwt.verify(
                auth.substring(7), process.env.JWT_SECRET
            )
            const currentUser = await User.findById(decodedToken.id)
            return { currentUser }
        }
    }
})

server.listen().then(({ url }) => {
    console.log(`Server ready at ${url}`)
})