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
Backboneio.PubSub = _.extend {}, Backbone.Events

_.extend Backboneio.socketQueue, Backbone.Events,
  _eventQueue: {}


Backboneio.Socket = (options) ->
  @options = @options || {}
  options = _.extend(@options, options)
  Backboneio.View::socket = @ if server
  if options.port?
    @connect()
  @initialize.apply @, arguments

_.extend Backboneio.Socket::, Backbone.Events,
  initialize: (options) ->

  connect: () ->
    @_connectServer() if server
    @_connect() if not server
    @

  _connect: () ->
    if @options.host? and @options.port?
      full_hostname = 'http://' + @options.host + ':' + @options.port
      _socket = io.connect full_hostname
      _sockets = io.sockets
      Backboneio.View::socket = _socket
      @trigger('bbio.connect', _socket)

  _connectServer: () ->
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


class Backboneio.Model extends Backbone.Model
  constructor: (options) ->
    @pubsub = Backboneio.PubSub
    super
    @pubsub.on 'socket:connected', (socket) =>
      @socket = socket
      @pubsub.trigger 'socket:modelSet'

  # override this
  initialize: () ->

  fetch: (options) ->
    options = if options then _.clone(options) else {}
    model = @
    success = options.success
    options.success = (resp) ->
      return false if !model.set(model.parse(resp), options)
      success model, resp if success success
    options.error = Backbone.wrapError(options.error, model, options)
    return (this.sync || Backbone.sync).call(this, 'read', this, options)

class Backboneio.Collection extends Backbone.Collection
  constructor: (models, options) ->
    @pubsub = Backboneio.PubSub
    @key = options.key if options? and options.key?
    super
    @pubsub.on 'socket:connected', (socket) =>
      @socket = socket
      @pubsub.trigger 'socket:collectionSet'

    if @channel?
      @pubsub.on "bbio.sync:#{ @channel }", (data) =>
        console.log 'bbio.sync (collection)', @channel, data
        @add data.data

  # override this
  initialize: () ->

  fetch: (options) ->
    options = if options then _.clone(options) else {}
    options.parse = true if not options.parse?
    collection = @
    success = options.success
    options.success = (resp) ->
      console.log resp
      collection[if options.add then 'add' else 'reset'](collection.parse(resp), options);
      success collection, resp if success
    options.error = Backbone.wrapError options.error, collection, options
    return (this.sync || Backbone.sync).call(this, 'read', this, options)

class Backboneio.View extends Backbone.View
  constructor: (options) ->
    @pubsub = Backboneio.PubSub
    @pubsub.on 'socket:connected', (socket) =>
      @socket = socket
      @pubsub.trigger 'socket:viewSet'

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
    return if not (events or (events = getValue(@, 'sockets')))
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

class Backboneio.ListView extends Backboneio.View
  constructor: (options) ->
    super

    @collection.on 'add', @add, @
    @collection.on 'reset', @render, @

  add: (model) ->
    @$el.find('.listview').append Handlebars.compile(@template)(model.toJSON())
    @

  render: (e) ->
    @collection.each (model) =>
      @$el.append Handlebars.compile(@template)(model.toJSON())


# Taken from backbone.js
getValue = (object, prop) ->
  return null if not (object and object[prop])
  return if _.isFunction object[prop] then object[prop]() else object[prop]


###
# Override Backbone.sync to sync via webSockets if a URL isn't defined
###
oldSync = Backbone.sync

Backbone.sync = (method, model, options) ->
  _defaultSocketActions = 
    read: 'read'
    create: 'create'

  channel = getValue model, 'channel'
  channel = getValue model.collection, 'channel' if not channel?
  key = getValue model, 'key'
  key = getValue model.collection, 'key' if not key?
  console.log 'Backbone.sync', method, model, options, channel, key
  cb = if options.success? then options.success else ->
  if channel
    socket.emit 'bbio.sync',
      channel: channel
      action: _defaultSocketActions[method]
      key: key
      data: model
    , cb

  else
    oldSync.apply @, arguments


