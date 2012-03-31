# Introduction #
Just an experiment with Backbone.js and Socket.io on both, client and server.  Not sure if this is a good way to do things or not.


## Example Usage ##
An example usage of backboneio...

### Client ####
```coffee
server = if typeof(exports) != 'undefined' then true else false

class AppView extends Backboneio.View
  initialize: (@opt) ->

  sevents:
    'connect': 'connected'
    'news': 'news'

  connected: () ->
    console.log 'client_init, connected to server'
    @emit 'auth', sessionkey: $.cookie('session')

  news: (data) ->
    #$('#chat-box .listview').append '<p>' + data + '</p>'
    console.log 'news: ', data

class ChatView extends Backboneio.View
  initialize: () ->
    @channel = 'chat'

  events:
    'keypress .chat-input': 'chatInput'

  sevents:
    'chat': 'newChat'

  newChat: (data) ->
    @$el.find('.listview').append '<p>' + data.user + ': ' + data.msg + '</p>'

  chatInput: (e) ->
    $target = $(e.currentTarget).find 'input'
    val = $target.val()
    if e.which is 13 and val.length
      @emit msg: val
      $target.val ''


socketio = new Backboneio.Socket
  host: 'localhost'
  port: 6969

app = new AppView()
chat = new ChatView
  el: '#chat-box'
```

### Server ###
```coffee
redis = require 'redis'
_ = require 'underscore'

r = redis.createClient()
Backboneio = require('backboneio').Backboneio

server = if typeof(exports) != 'undefined' then true else false

class AppView extends Backboneio.View
  initialize: () ->

  sevents:
    'bbio.connect': 'connected'

  connected: (socket, data) ->
    r.llen 'chat.global', (err, chatlen) =>
      r.lrange 'chat.global', -5, chatlen, (err, history) =>
        _.each history, (chat) =>
          socket.emit 'chat', JSON.parse chat

class ChatView extends Backboneio.View
  initialize: () ->
    @channel = 'chat'

  sevents:
    'chat': 'newChat'
    'auth': 'auth'

  auth: (socket, data) ->
    r.get 'sessionkey:' + data.sessionkey, (err, userid) =>
      if not err? and userid?
        r.hget 'user:' + userid, 'username', (err, username) =>
          socket.set 'userid', userid
          socket.set 'username', username
          # get chat history
          @sockets.emit 'news', username + ' has connected.'
          socket.emit 'auth', success: true
      else
        @sockets.emit 'news', 'Guest has connected.'
        socket.emit 'auth', success: false


  newChat: (socket, data) ->
    socket.get 'username', (err, user) =>
      if not err? and user?
        # publish to redis
        data =
          msg: data.msg
          user: user
          timestamp: new Date().getTime()
        @sockets.emit 'chat', data
        data = JSON.stringify data
        r.rpush 'chat.global', data


socketio = new Backboneio.Socket
  host: 'localhost'
  port: 6969

app = new AppView()
chat = new ChatView()
```