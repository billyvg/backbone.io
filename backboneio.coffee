root = @
_ = root._ or (require('underscore')._ if not _? and require?)
Backbone = root.Backbone or (require('backbone') if not Backbone? and require?)
io = root.io or (require('socket.io') if not io? and require?)

if typeof(exports) != 'undefined'
  exports.Backboneio = Backboneio = {}
  server = true
else
  root.Backboneio = Backboneio = {}
  server = false


Backboneio.socketQueue = {}
Backboneio._sockets = {}

_.extend Backboneio.socketQueue, Backbone.Events,
  _eventQueue: {}


Backboneio.Socket = (options) ->
  @options = @options || {}
  options = _.extend(@options, options)
  @initialize.apply @, arguments

_.extend Backboneio.Socket::, Backbone.Events,
  initialize: (options) ->
    Backboneio.View::socket = @ if server
    if options.port?
      @connect()

  connect: () ->
    @_connect_server() if server
    @_connect() if not server
    return

  _connect: () ->
    if @options.host? and @options.port?
      full_hostname = 'http://' + @options.host + ':' + @options.port
      _socket = io.connect full_hostname
      _sockets = io.sockets
      Backboneio.View::socket = _socket
      @trigger('bbio.connect', _socket)

  _connect_server: () ->
    if @options.port?
      io = io.listen @options.port
      @io = io.sockets
      Backboneio.View::sockets = @io
      @io.on 'connection', (socket) =>
        @trigger('bbio.connect', socket)

        $emit = socket.$emit
        socket.$emit = (event, data) =>
          @trigger(event, socket, data)

          $emit.apply(socket, arguments);


class Backboneio.View extends Backbone.View
    constructor: (options) ->
      @cid = _.uniqueId 'view'
      @_configure(options or {})
      if not server
        @_ensureElement()
      @initialize.apply(@, arguments)
      @delegateEvents()

    initialize: () ->

    _configure: (options) ->
      super options
      @socket = options.socket if options.socket

    delegateEvents: (events) ->
      @delegateSockets()
      if not server
        super events

    delegateSockets: (events) ->
      return if not (events or (events = getValue(@, 'sevents')))
      @_sevents_lookup = {}

      @undelegateSockets()
      for key of events
        method = events[key]
        method = @[events[key]] if not _.isFunction(method)
        throw new Error('Socket Event "' + events[key] + '" does not exist') if not method
        method = _.bind method, @
        # we could keep this as delegateEvents, but there might be a case where
        # you need to clear specific socket vs non-socket events?
        #eventName = key + '.delegateSockets'
        eventName = key
        @_sevents_lookup[method] = eventName


        if @socket?
          @socket.on eventName, method
        else
          # TODO
          Backboneio.socketQueue._eventQueue[eventName] = method


    emit: () ->
      # TODO
      if arguments.length == 1
        channel = if @channel? then @channel else @_sevents_lookup[arguments.callee.caller.toString()]
        args = arguments[0]
      else
        channel = arguments[0]
        args = arguments[1]

      @socket.emit channel, args

    undelegateSockets: () ->
      if @socket.removeAllListeners?
        @socket.removeAllListeners()
      else
        @socket.off(eventName) for eventName in @_sevents_lookup

    _delegateQueue: () ->
      # TODO
      if @socket?
        @socket.on(eventName, method) for eventName, method of socketQueue._eventQueue
        socketQueue._eventQueue = {}


# Taken from backbone.js
getValue = (object, prop) ->
  return null if not (object and object[prop])
  return if _.isFunction object[prop] then object[prop]() else object[prop]

