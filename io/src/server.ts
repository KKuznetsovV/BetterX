import { Server, Socket } from 'socket.io'
import config from 'config'

const port = config.get<number>('app.port')

const server = new Server({
    cors: {
        origin: '*'
    }
})
server.on('connection', socket => {
    socket.onAny((eventName: string, payload: object) => {
        server.emit(eventName, payload)
    })
})

server.listen(port)

console.log(`io server started on ${port}`)
