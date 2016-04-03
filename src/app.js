/**
 * @file Base namespace and heart for App JavaScript.
 * @author Honza Hommer <honza@pixelbay.cz>
 * @example
 *
 * var app = new App();
 * // > Init App and process queue
 *
 * app.ready(function (me) {
 *   console.log('I am inside and DOM is ready', me);
 * }, $);
 * // > DOM ready wrapper
 *
 * app(function (me) {
 *   console.log('I am inside and DOM is ready', me);
 * }, $);
 * // > Shortcut for DOM ready wrapper
 *
 * app.set('key', ...);
 * // > Set property to App data store
 *
 * app('key', ...);
 * // > Shortcut for set property to App data store
 *
 * App.get('key', 'defaultValue');
 * // > Get property from App data store
 *
 * app('key');
 * // > Shortcut for get property from App data store
 *
 */

/**
 * We use this to make sure we don't assign globals unless we actually want to
 *
 * @param {window} window
 * @param {document} document
 * @param {undefined} [undefined]
 */
(function(window, document, undefined) {
    'use strict';

    /** @borrows Array.prototype.slice as slice */
    var slice = Array.prototype.slice;

    /**
     * sets or gets  the value at `path` of `object`.
     *
     * @param {Object} object The object to query.
     * @param {Array|string} path The path of the property to get.
     * @param {*} [value] The value returned if the resolved value is `undefined`.
     * @param {Boolean} [create] Specify `create` the missing object properties.
     * @returns {*} Returns the resolved value.
     */
    var _getOrSet = function (object, path, value, create) {
        if (typeof path === 'string') {
            // convert indexes to properties
            // string = string.replace(/\[(\w+)\]/g, '.$1');
            path = path.replace(/\[(\w+)]/g, '.$1');
            // strip a leading dot
            path = path.replace(/^\./, '');
            // path to array
            path = path.split('.');
        }

        for (var i = 0, n = path.length; i < n; ++i) {
            var key = path[i];
            var exists = key in object;

            // create path if path not `exists` and if `create` is set to true
            if (exists === false && create === true) {
                exists = true;

                // on last value set `value`, else set `object`
                object[key] = ((i + 1) === n) ? value : {};
            }

            if (exists === true) {
                object = object[key];
            } else {
                return value;
            }
        }

        return object;
    };

    /**
     * The one global object for App JavaScript.
     *
     * @param {Function|Array|string} [path] The path of the property to get.
     * @param {*} [value] The value to set.
     * @returns {*} Returns the resolved value.
     * @constructor
     */
    var App = function (path, value) {
        var loader = window[typeof APP_LOADER_VAR === 'string' ? APP_LOADER_VAR : 'app'];
        var self = this;

        // app is not ready yet, call on ready handler
        // and process old queue
        if (self.appready === false) {
            self.time = self.now();

            // Mark App as ready
            self.appready = true;

            // Log ready
            console.info('App: Ready and waiting for DOM...', (self.time - loader.time) ,'ms');

            // Watch DOC ready handler
            self.ready(function () {
                self.domready = true;

                // Log DOM ready
                console.info('App: Hurray, DOM is ready... ', (self.now() - self.time) ,'ms');
            });

            // Process loader queue
            self.each(loader.queue, function (item) {
                self.constructor.apply(self, item);
            });
        }

        switch(typeof path) {
            case 'string':
                var isSetter = typeof value !== 'undefined';

                return _getOrSet(self.data, path.toLowerCase(), isSetter ? value : undefined, !!isSetter);
            case 'function':
                return self.ready.apply(self, arguments);
        }

        return self.domready;
    };

    //-------------------------------------------------------------------------
    // Passthrough Methods
    //-------------------------------------------------------------------------

    App.prototype = {
        app: '@VERSION',

        // restore constructor
        constructor: App,

        /** @type {boolean} */
        debug: !!window.APP_DEBUG,

        /** @type {boolean} */
        appready: false,

        /** @type {boolean} */
        domready: document.readyState !== 'loading',

        /** @type {Object} */
        data: {},

        /**
         * Signals that an error has occurred. If in development mode, an error
         * is thrown.
         *
         * @param {error} [exception] The exception object to use.
         * @throws Will throw an error exception if in dev mode
         * @returns {void}
         */
        error: function (exception) {
            if (this.debug === true) {
                throw exception;
            }
        },

        /**
         * Document ready handler.
         *
         * @param {Function} handler A function to execute after the DOM is ready.
         * @param {*} [args] Any number of arguments to be passed to the function referenced in the handler argument.
         */
        ready: function (handler, args) {
            var thisArgs = slice.call(arguments, 1);

            function readyFn () {
                // jQuery DOM ready fires after this DOM ready listener,
                // 1ms timeout fix it...
                setTimeout(function () {
                    handler.apply(undefined, thisArgs);
                }, 1);
            }

            if (document.readyState !== 'loading') {
                readyFn();
            } else if (document.addEventListener) {
                document.addEventListener('DOMContentLoaded', function () {
                    readyFn();
                });
            } else {
                //noinspection JSUnresolvedFunction
                document.attachEvent('onreadystatechange', function() {
                    if (document.readyState !== 'loading') {
                        readyFn();
                    }
                });
            }
        },

        /**
         * @borrows _getOrSet as get
         */
        get: function (path, defaultValue) {
            return _getOrSet(this, path, defaultValue);
        },

        /**
         * @borrows _getOrSet as set
         */
        set: function (path, value) {
            return _getOrSet(this, path, value, true);
        },

        /**
         * Takes a function and returns a new one that will always have a particular context.
         *
         * @param {*} [context=App] The object to which the context (this) of the function should be set.
         * @param {Function|Array} func The function whose context will be changed.
         * @param {*} [args] Array of arguments or any number of arguments to be passed to the function referenced in the function argument.
         * @returns {Function} Returns the new wrapped function.
         */
        proxy: function (context, func, args) {
            var thisObj;
            var thisFunc;
            var thisArgs;

            if (typeof context === 'function') {
                thisObj = App;
                thisFunc = context;
                thisArgs = this.isArray(func) ? func : slice.call(arguments, 1);
            } else {
                thisObj = context;
                thisFunc = func;
                thisArgs = this.isArray(args) ? args : slice.call(arguments, 2);
            }

            return thisFunc.apply(thisObj, thisArgs);
        },

        /**
         * Iterates over elements of `collection` invoking `iteratee` for each element.
         *
         * @param {Array} collection
         * @param {Function} iteratee
         * @example
         *
         * App.for(array, function (item, i) { ... });
         */
        each: function (collection, iteratee) {
            if (this.isArray(collection) === false) {
                return;
            }
            
            for (var i = 0; i < collection.length; i++) {
                iteratee(collection[i], i);
            }
        },

        /** @borrows self.each as self.for */
        for: self.each,

        /**
         * Iterates over elements of `collection` invoking `iteratee` for each element.
         *
         * @param {Object} collection
         * @param {Function} iteratee
         * @example
         *
         * App.forEach(object, function (item, key) { ... });
         */
        forEach: function (collection, iteratee) {
            if (this.isArray(collection) === false) {
                return;
            }
            
            for (var prop in collection) {
                if(collection.hasOwnProperty(prop)) {
                    iteratee(collection[prop], prop);
                }
            }
        },

        /**
         * Base implementation of recursively extend.
         *
         * @param {Object} out The destination object.
         * @param {...Object} [sources] The source objects.
         * @returns {Object} Returns `out`.
         */
        deepExtend: function (out, sources) {
            var self = this;

            out = out || {};

            for (var i = 1; i < arguments.length; i++) {
                var obj = arguments[i];

                if (!obj) {
                    continue;
                }

                for (var key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        if (typeof obj[key] === 'object')
                            out[key] = self.deepExtend(out[key], obj[key]);
                        else
                            out[key] = obj[key];
                    }
                }
            }

            return out;
        },

        /**
         * Base implementation of extend.
         *
         * @param {Object} [out] The destination object.
         * @param {...Object} [sources] The source objects.
         * @returns {Object} Returns `out`.
         */
        extend: function(out, sources) {
            if (typeof out !== 'object') { out = {}; }

            for (var i = 1; i < arguments.length; i++) {
                if (!arguments[i]) {
                    continue;
                }

                for (var key in arguments[i]) {
                    if (arguments[i].hasOwnProperty(key)) {
                        out[key] = arguments[i][key];
                    }
                }
            }

            return out;
        },

        /**
         * Gets the index at which the first occurrence of `value` is found in `array`.
         *
         * @param {Array} array The array to search.
         * @param {*} target The value to search for.
         * @returns {number} Returns the index of the matched value, else `-1`.
         */
        indexOf: function (array, target) {
            for (var i = 0; i < array.length; i++) {
                if (array[i] === target) {
                    return i;
                }
            }

            return -1;
        },

        /**
         * Checks if `value` is classified as an `Array` object.
         *
         * @param {Array} value The array to check.
         * @returns {boolean} Returns `true` if `value` is a host object, else `false`.
         */
        isArray: function (value) {
            return Object.prototype.toString.call(value) === '[object Array]';
        },

        /**
         * Implementation of map.
         *
         * @param {Array} collection The collection to iterate over.
         * @param {Function} iteratee(value, index) The function invoked per iteration.
         * @returns {Array} Returns the new mapped array.
         */
        map: function (collection, iteratee) {
            var results = [];

            for (var i = 0; i < collection.length; i++) {
                results.push(iteratee(collection[i], i));
            }

            return results;
        },

        /**
         * Gets the timestamp of the number of milliseconds that have elapsed since
         * the Unix epoch (1 January 1970 00:00:00 UTC).
         *
         * @returns {number} Return a number representing the current time.
         */
        now: function () {
            return new Date().getTime();
        },

        /**
         * Get HTML from `data`.
         *
         * @param {string} data
         * @returns {HTMLElement[]}
         */
        parseHtml: function(data) {
            var el = document.createElement('div');

            el.innerHTML = data;

            return el.children;
        },

        /**
         * Try to parse `actor` to JSON.
         *
         * @param {string} json The JSON string to parse.
         * @returns {Object} Returns the resulting JavaScript value.
         */
        parseJson: function (json) {
            return JSON.parse(json);
        },

        /**
         * Split CamelCase string to array like object
         *
         * @param {string} string The CamelCase string.
         * @returns {Array} Returns array..
         */
        parseCamelCase: function (string) {
            return string.split(/(?=[A-Z])/).map(function(s) {
                return s.toLowerCase();
            });
        },

        /**
         * Removes leading and trailing whitespace or specified characters from `string`.
         *
         * @param {string} string The string to trim.
         * @returns {Object} Returns the trimmed string.
         */
        trim: function (string) {
            return string.replace(/^\s+|\s+$/g, '');
        },

        /**
         * get `actor` type.
         *
         * @param {*} actor The value to check.
         * @returns {string} Returns the `actor` type.
         */
        type: function (actor) {
            //return Object.prototype.toString.call(actor).replace(/^\[object (.+)\]$/, '$1').toLowerCase();
            return Object.prototype.toString.call(actor).replace(/^\[object (.+)]$/, '$1').toLowerCase();
        },

        /**
         * Checks if `value` is `undefined`.
         *
         * @param {*} value The value to check.
         * @returns {boolean} Returns `true` if `value` is `undefined`, else `false`.
         */
        isUndefined: function (value) {
            return value === undefined;
        },

        /**
         * Wraps all methods on an object with try-catch so that objects don't need
         * to worry about trapping their own errors. When an error occurs, the
         * error event is fired with the error information.
         *
         * @see http://www.nczonline.net/blog/2009/04/28/javascript-error-handling-anti-pattern/
         * @param {Object} object Any object whose public methods should be wrapped.
         * @param {string} name The name that should be reported for the object when an error occurs.
         */
        protect: function (object, name) {
            var self = this;

            for (var property in object) {
                if (object.hasOwnProperty(property)) {
                    var value = object[property];

                    // only do this for methods, be sure to check before making changes!
                    if (typeof value === 'function') {
                        // This creates a new function that wraps the original function
                        // in a try-catch. The outer function executes immediately with
                        // the name and actual method passed in as values. This allows
                        // us to create a function with specific information even though
                        // it's inside of a loop.
                        object[property] = (function(fnName, fn) {
                            return function() {
                                try {
                                    return fn.apply(this, arguments);
                                } catch (ex) {
                                    var errorPrefix = name + '.' + fnName + '() - ';

                                    ex.methodName = fnName;
                                    ex.name = name;
                                    ex.name = errorPrefix + ex.name;
                                    ex.message = errorPrefix + ex.message;
                                    self.error(ex);
                                }
                            };

                        }(property, value));
                    }
                }
            }
        },

        /**
         * Generate unique ID for HTML element.
         *
         * @param {string} [prefix] The prefix of generated UID.
         * @returns {string} The generated UID.
         */
        getUID: function (prefix) {
            prefix = prefix || '';

            do {
                prefix += ~~(Math.random() * 1000000);
            } while (document.getElementById(prefix));

            return prefix;
        },

        /**
         * Returns version if browser is IE, for others browsers returns false.
         *
         * @type {Boolean|number}
         */
        ie: (function () {
            var ua = window.navigator.userAgent;

            var msie = ua.indexOf('MSIE ');
            if (msie > 0) {
                // IE 10 or older => return version number
                return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
            }

            var trident = ua.indexOf('Trident/');
            if (trident > 0) {
                // IE 11 => return version number
                var rv = ua.indexOf('rv:');
                return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
            }

            var edge = ua.indexOf('Edge/');
            if (edge > 0) {
                // Edge (IE 12+) => return version number
                return parseInt(ua.substring(edge + 5, ua.indexOf('.', edge)), 10);
            }

            return false;
        })(),

        /**
         * A no-operation function that returns `undefined` regardless of the
         * arguments it receives.
         *
         * @returns {function} Return empty function
         */
        noop: function () {},

        /**
         * A no-operation function that returns `false`.
         *
         * @returns {Boolean} Return false
         */
        falsy: function () {
            return false;
        },

        /**
         * A no-operation function that returns `true`
         *
         * @returns {Boolean} Return true
         */
        truthy: function () {
            return true;
        }
    };

    // Assign App as window property
    var that = window[typeof APP_VAR === 'string' ? APP_VAR : 'App'] = App;

    // Copy all properties onto namespace (ES3 safe for loop)
    for (var key in App) {
        if (App.hasOwnProperty(key)) {
            that[key] = App[key];
        }
    }

}(window, document));
