(function() {
  var Backbone, Backboneio, getValue, io, root, server, _,
    __hasProp = Object.prototype.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  root = this;

  _ = root._ || (!(_ != null) && (typeof require !== "undefined" && require !== null) ? require('underscore')._ : void 0);

  Backbone = root.Backbone || (!(Backbone != null) && (typeof require !== "undefined" && require !== null) ? require('backbone') : void 0);

  io = root.io || (!(io != null) && (typeof require !== "undefined" && require !== null) ? require('socket.io') : void 0);

  if (typeof exports !== 'undefined') {
    exports.Backboneio = Backboneio = {};
    server = true;
  } else {
    root.Backboneio = Backboneio = {};
    server = false;
  }

  Backboneio.socketQueue = {};

  Backboneio._sockets = {};

  _.extend(Backboneio.socketQueue, Backbone.Events, {
    _eventQueue: {}
  });

  Backboneio.Socket = function(options) {
    this.options = this.options || {};
    options = _.extend(this.options, options);
    return this.initialize.apply(this, arguments);
  };

  _.extend(Backboneio.Socket.prototype, Backbone.Events, {
    initialize: function(options) {
      if (server) Backboneio.View.prototype.socket = this;
      if (options.port != null) return this.connect();
    },
    connect: function() {
      if (server) this._connect_server();
      if (!server) this._connect();
    },
    _connect: function() {
      var full_hostname, _socket, _sockets;
      if ((this.options.host != null) && (this.options.port != null)) {
        full_hostname = 'http://' + this.options.host + ':' + this.options.port;
        _socket = io.connect(full_hostname);
        _sockets = io.sockets;
        Backboneio.View.prototype.socket = _socket;
        return this.trigger('bbio.connect', _socket);
      }
    },
    _connect_server: function() {
      var _this = this;
      if (this.options.port != null) {
        io = io.listen(this.options.port);
        this.io = io.sockets;
        Backboneio.View.prototype.sockets = this.io;
        return this.io.on('connection', function(socket) {
          var $emit;
          _this.trigger('bbio.connect', socket);
          $emit = socket.$emit;
          return socket.$emit = function(event, data) {
            _this.trigger(event, socket, data);
            return $emit.apply(socket, arguments);
          };
        });
      }
    }
  });

  Backboneio.View = (function(_super) {

    __extends(View, _super);

    function View(options) {
      this.cid = _.uniqueId('view');
      this._configure(options || {});
      if (!server) this._ensureElement();
      this.initialize.apply(this, arguments);
      this.delegateEvents();
    }

    View.prototype.initialize = function() {};

    View.prototype._configure = function(options) {
      View.__super__._configure.call(this, options);
      if (options.socket) return this.socket = options.socket;
    };

    View.prototype.delegateEvents = function(events) {
      this.delegateSockets();
      if (!server) return View.__super__.delegateEvents.call(this, events);
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
          _results.push(this.socket.on(eventName, method));
        } else {
          _results.push(Backboneio.socketQueue._eventQueue[eventName] = method);
        }
      }
      return _results;
    };

    View.prototype.emit = function() {
      var args, channel;
      if (arguments.length === 1) {
        channel = this.channel != null ? this.channel : this._sevents_lookup[arguments.callee.caller.toString()];
        args = arguments[0];
      } else {
        channel = arguments[0];
        args = arguments[1];
      }
      return this.socket.emit(channel, args);
    };

    View.prototype.undelegateSockets = function() {
      var eventName, _i, _len, _ref, _results;
      if (this.socket.removeAllListeners != null) {
        return this.socket.removeAllListeners();
      } else {
        _ref = this._sevents_lookup;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          eventName = _ref[_i];
          _results.push(this.socket.off(eventName));
        }
        return _results;
      }
    };

    View.prototype._delegateQueue = function() {
      var eventName, method, _ref;
      if (this.socket != null) {
        _ref = socketQueue._eventQueue;
        for (eventName in _ref) {
          method = _ref[eventName];
          this.socket.on(eventName, method);
        }
        return socketQueue._eventQueue = {};
      }
    };

    return View;

  })(Backbone.View);

  getValue = function(object, prop) {
    if (!(object && object[prop])) return null;
    if (_.isFunction(object[prop])) {
      return object[prop]();
    } else {
      return object[prop];
    }
  };

}).call(this);
