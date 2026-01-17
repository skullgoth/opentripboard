// T038: WebSocket server setup with authentication handshake
import { verifyToken } from '../utils/jwt.js';
import { joinRoom, leaveRoom, broadcastToRoom } from './rooms.js';
import { handleMessage } from './handler.js';
import logger from '../utils/logger.js';

/**
 * WebSocket server routes
 */
export default async function websocketRoutes(fastify) {
  /**
   * WebSocket connection endpoint
   * Clients connect to: ws://localhost/ws
   */
  fastify.get('/', { websocket: true }, (connection, request) => {
    const { socket } = connection;
    let authenticated = false;
    let userId = null;
    let currentRoomId = null;

    logger.debug('WebSocket connection attempt', { ip: request.ip });

    // Set connection timeout for authentication
    const authTimeout = setTimeout(() => {
      if (!authenticated) {
        logger.warn('WebSocket authentication timeout', { ip: request.ip });
        socket.send(JSON.stringify({
          type: 'error',
          message: 'Authentication timeout',
        }));
        socket.close(1008, 'Authentication timeout');
      }
    }, 10000); // 10 seconds to authenticate

    /**
     * Handle incoming messages
     */
    socket.on('message', async (rawMessage) => {
      try {
        const message = JSON.parse(rawMessage.toString());

        // First message must be authentication
        if (!authenticated) {
          if (message.type !== 'auth') {
            socket.send(JSON.stringify({
              type: 'error',
              message: 'Authentication required',
            }));
            return;
          }

          // Verify token
          try {
            const decoded = verifyToken(message.token);

            if (decoded.type !== 'access') {
              throw new Error('Invalid token type');
            }

            authenticated = true;
            userId = decoded.userId;
            clearTimeout(authTimeout);

            logger.info('WebSocket authenticated', { userId });

            socket.send(JSON.stringify({
              type: 'auth:success',
              userId,
            }));

          } catch (error) {
            socket.send(JSON.stringify({
              type: 'auth:error',
              message: error.message || 'Authentication failed',
            }));
            socket.close(1008, 'Authentication failed');
          }

          return;
        }

        // Handle room join/leave
        if (message.type === 'room:join') {
          logger.info('Received room:join message', { userId, tripId: message.tripId });
          const { tripId } = message;

          if (!tripId) {
            socket.send(JSON.stringify({
              type: 'error',
              message: 'tripId is required',
            }));
            return;
          }

          // Leave current room if any
          if (currentRoomId) {
            leaveRoom(currentRoomId, userId, socket);
          }

          // Join new room
          joinRoom(tripId, userId, socket);
          currentRoomId = tripId;

          // Get current users in room (including self)
          const { getRoomUsers } = await import('./rooms.js');
          const activeUsers = getRoomUsers(tripId);

          logger.info('Sending room:joined response', { userId, tripId, activeUsers });

          socket.send(JSON.stringify({
            type: 'room:joined',
            tripId,
            activeUsers, // Send list of all active users
          }));

          logger.info('Broadcasting presence:join', { userId, tripId });
          // Broadcast presence update to others
          broadcastToRoom(
            tripId,
            {
              type: 'presence:join',
              userId,
              timestamp: new Date().toISOString(),
            },
            userId // Exclude self
          );

          return;
        }

        if (message.type === 'room:leave') {
          if (currentRoomId) {
            leaveRoom(currentRoomId, userId, socket);

            // Broadcast presence update
            broadcastToRoom(
              currentRoomId,
              {
                type: 'presence:leave',
                userId,
                timestamp: new Date().toISOString(),
              },
              userId // Exclude self
            );

            currentRoomId = null;

            socket.send(JSON.stringify({
              type: 'room:left',
            }));
          }
          return;
        }

        // Handle other message types
        if (currentRoomId) {
          await handleMessage(message, {
            userId,
            tripId: currentRoomId,
            socket,
          });
        } else {
          socket.send(JSON.stringify({
            type: 'error',
            message: 'Must join a room first',
          }));
        }

      } catch (error) {
        logger.error('WebSocket message error', { error });
        socket.send(JSON.stringify({
          type: 'error',
          message: 'Failed to process message',
        }));
      }
    });

    /**
     * Handle connection close
     */
    socket.on('close', () => {
      logger.debug('WebSocket close event', { userId: userId || 'unauthenticated' });
      clearTimeout(authTimeout);

      if (currentRoomId && userId) {
        logger.debug('WebSocket leaving room', { roomId: currentRoomId, userId });
        leaveRoom(currentRoomId, userId, socket);

        // Broadcast presence update
        logger.debug('Broadcasting presence:leave', { userId });
        broadcastToRoom(
          currentRoomId,
          {
            type: 'presence:leave',
            userId,
            timestamp: new Date().toISOString(),
          },
          userId
        );
      }

      logger.info('WebSocket connection closed', { userId: userId || 'unauthenticated' });
    });

    /**
     * Handle errors
     */
    socket.on('error', (error) => {
      logger.error('WebSocket error', { error });
    });
  });
}
