(function() {
  var Backbone, Backboneio, getValue, io, root, server, socketQueue, _, _socket, _sockets,
    __slice = Array.prototype.slice,
    __hasProp = Object.prototype.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  root = this;

  _ = root._ || (!(_ != null) && (typeof require !== "undefined" && require !== null) ? require('underscore')._ : void 0);

  Backbone = root.Backbone || (!(Backbone != null) && (typeof require !== "undefined" && require !== null) ? require('backbone') : void 0);

  io = root.io || (!(io != null) && (typeof require !== "undefined" && require !== null) ? require('socket.io') : void 0);

  socketQueue = {};

  socketQueue = _.extend(socketQueue, Backbone.Events, {
    _eventQueue: {}
  });

  _sockets = _socket = false;

  Backboneio = {
    connect: function(connect) {
      if (connect != null) return this._route('_connect', connect);
    },
    _route: function() {
      var method, params;
      method = arguments[0], params = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      method += server ? '__server' : '';
      if (this[method] != null) return this[method].apply(this, params);
    },
    _connect: function(ioserver) {
      console.log('connecting to socket');
      if (ioserver != null) _socket = io.connect(ioserver);
      _sockets = io.sockets;
      return socketQueue.trigger('connect.bbio');
    },
    _connect__server: function(port) {
      io = io.listen(port);
      _sockets = io.sockets;
      _sockets.on('connection', function(socket) {
        console.log('connection');
        _socket = socket;
        return socketQueue.trigger('connect.bbio connect.server.bbio');
      });
      return _sockets.on('connection', function(socket) {
        return console.log('connection2');
      });
    }
  };

  Backboneio.View = (function(_super) {

    __extends(View, _super);

    function View(options) {
      socketQueue.on('connect.bbio', this._socketConnected, this);
      this.cid = _.uniqueId('view');
      this._configure(options || {});
      if (!server) this._ensureElement();
      if ((options != null) && (options.connect != null)) {
        Backboneio.connect(options.connect);
      }
      if (_sockets) this.sockets = _sockets;
      if (_socket) this.socket = _socket;
      this.initialize.apply(this, arguments);
      this.delegateEvents();
    }

    View.prototype.delegateEvents = function(events) {
      this.delegateSockets();
      return View.__super__.delegateEvents.call(this, events);
    };

    View.prototype.delegateSockets = function(events) {
      var eventName, key, method, _results;
      if (!(events || (events = getValue(this, 'sevents')))) return;
      this._sevents_lookup = {};
      this.undelegateSockets();
      _results = [];
      for (key in events) {
        method = events[key];
        if (!_.isFunction(method)) method = this[events[key]];
        if (!method) {
          throw new Error('Socket Event "' + events[key] + '" does not exist');
        }
        method = _.bind(method, this);
        eventName = key;
        this._sevents_lookup[method] = eventName;
        if (this.socket != null) {
          console.log('socket is set', eventName);
          _results.push(this.socket.on(eventName, method));
        } else {
          console.log('queueing: ', eventName);
          _results.push(socketQueue._eventQueue[eventName] = method);
        }
      }
      return _results;
    };

    View.prototype.emit = function() {
      var args, channel;
      if (arguments.length === 1) {
        channel = this.channel != null ? this.channel : this._sevents_lookup[arguments.callee.caller.toString()];
        args = arguments;
      } else {
        channel = arguments[0];
        args = arguments[1];
      }
      console.log('emit', channel, args);
      return this.socket.emit(channel, args);
    };

    View.prototype.undelegateSockets = function() {
      return '';
    };

    View.prototype._socketConnected = function() {
      if (_sockets) this.sockets = _sockets;
      if (_socket) this.socket = _socket;
      return this._delegateQueue();
    };

    View.prototype._delegateQueue = function() {
      var eventName, method, _ref, _results;
      console.log('delegateQueue called', socketQueue._eventQueue);
      _ref = socketQueue._eventQueue;
      _results = [];
      for (eventName in _ref) {
        method = _ref[eventName];
        _results.push(this.socket.on(eventName, method));
      }
      return _results;
    };

    return View;

  })(Backbone.View);

  root.socketQueue = socketQueue;

  getValue = function(object, prop) {
    if (!(object && object[prop])) return null;
    if (_.isFunction(object[prop])) {
      return object[prop]();
    } else {
      return object[prop];
    }
  };

  if (typeof exports !== 'undefined') {
    exports.Backboneio = Backboneio;
    server = true;
  } else {
    root.Backboneio = Backboneio;
    server = false;
  }

}).call(this);
