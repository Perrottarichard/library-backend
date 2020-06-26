const { ApolloServer, gql, UserInputError } = require('apollo-server')
const { PubSub } = require('apollo-server')
require('dotenv').config()
const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')
const Author = require('./models/Author')
const Book = require('./models/Book')
const User = require('./models/User')

const pubsub = new PubSub()

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
      me: User!
      filterByGenre(genre: String!): [Book!]!
  }
  type Subscription {
      bookAdded: Book!
  }
`

const resolvers = {
    Query: {
        filterByGenre: (root, args) => {
            return Book.find({ genres: { $in: [args.genre] } }).populate('author')
        },
        me: (root, args, context) => {
            return context.currentUser
        },
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
                return Book.find({ genres: $in[args.genre] }).populate('author')
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
        bookCount: async (root) => {
            let count = await Book.countDocuments({ author: root._id })
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
            let book = new Book({ ...args })
            try {
                await book.save()
            } catch (error) {
                throw new UserInputError(error.message, { invalidArgs: args })
            }
            book = await Book.findById(book.id).populate('author')
            pubsub.publish('bookAdded', { bookAdded: book })
            return book
        },
        addAuthor: async (root, args) => {
            const author = new Author({ name: args.name })
            try {
                await author.save()
            } catch (error) {
                console.log(error)
            }
            return author
        },
        editAuthor: async (root, args) => {
            let matchedAuthor = await Author.findOne({ name: args.name })
            matchedAuthor.born = args.setBornTo
            return matchedAuthor.save()
        }
    },
    Subscription: {
        bookAdded: {
            subscribe: () => pubsub.asyncIterator('bookAdded')
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

server.listen().then(({ url, subscriptionsUrl }) => {
    console.log(`Server ready at ${url}`)
    console.log(`Subscriptions ready at ${subscriptionsUrl}`)
})