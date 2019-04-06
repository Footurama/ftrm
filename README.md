# Footurama

This is the core component. It glues this Frankenstein together. In the future this chapter will convince you that you should have a look into Footurama if you love IoT and would agree with these principals:

 * I love the Internet! But having to rely on it just to turn on your freaking lights is dumb. If someone on the path "*light switch -> local network -> local router -> ISP's network -> some Tier-1's network -> some sea cable -> some cloud provider with fancy names and SLAs over 9000 -> some sea cable -> some Tier-1's network -> ISP's network -> local router -> local network -> light bulb*" screws something up, you won't be able so switch your light on. I think you get the idea.
 * Speaking of which: Even don't rely on your home server. Be decentralised. If your fridge needs to have a conversation with your toaster, they should talk directly. No broker, no central server.
 * Just use the Internet to enhance your IoT. For example: What will the weather be tomorrow? Where is your mobile phone? Is Trump still the president of the US?

Wanna see an example? Check out the [Sandbox](https://github.com/Footurama/ftrm-sandbox).

Under the hood this thing is driven by [Partybus](https://github.com/jue89/node-partybus#readme). The implementation heavily relies on some newer JavaScript features for better readability of the source code. Thus, please use Node 8 for trying. Newer versions aren't working atm. Older versions neither. Sry. I'm gonna fix this in near future.

# Concept

This section should give you an overview of the used terms and the relationships.

The whole magic happens inside a *realm*. It groups all parts of your IoT application together. Inside the *realm* are your *nodes*. They are the computers (e.g. Raspberry Pi) that run the Footurama core. The core itself hosts several *components*. Every *component* can have several *inputs* and *outputs*. They are connected using *pipes* to exchange data. *pipes* reach across *node* boundaries. Thus, data can travel from one component running on node A to another component running on node B seamlessly.

# API for users

```js
const FTRM = require('ftrm');
FTRM(opts).then((ftrm) => { ... });
```

Starts a new Footurama instance. Optional ```opts``` has the following properties:
 * ```ca```: The CA certificate for you Iot stuff. Default: ```${cwd}/ca.crt.pem```
 * ```cert```: The X509 certificate for the local instance. It must be signed by the CA. Default: ```${cwd}/${hostname}/crt.pem```
 * ```key```: The private key of the local instance. Default: ```${cwd}/${hostname}/key.pem```
 * ```autoRunDir```: Automatically run all .js files in the given directory. Set to ```null``` if you don't want to run anything automatically. Default: ```${cwd}/${hostname}```
 * ```noSignalListeners```: Set this to ```true``` if you don't want Footurama to listen to SIGTERM and SIGINT signals and shutdown all loaded components automatically.
 * ```dryRun```: If set to ```true```, just options are checked and no nodes are actually started.

## Method: ftrm.run()

```js
ftrm.run(component, opts).then((ftrm) => {...});
```

Run the given ```component``` with stated ```opts```.

## Method: ftrm.runDir()

```js
ftrm.runDir(path).then((ftrm) => {...});
```

Load all .js files in given ```path```. Each must return an array: ```[component, opts]```. Those items are used to call ```ftrm.run(component, opts)```.

## Method: ftrm.shutdown()

```js
ftrm.shutdown().then(() => {...});
```

Stop all loaded components.

# API for component developer

The following line will load the NPM package *your-package* and look for the file *your-component.js*. This way you can bundle several components into one package.

```js
const component = require('your-package/your-component');
```

The loaded ```component``` is an object with the following properties:
 * ```factory```: A mandatory function to create an new instance of the component.
 * ```check```: An optional function to check the given parameters and set defaults. This is called before ```factory```.

The component's instantiation is based on the object ```opts``` that is given by the component's user. *(cf. API for users -> Method: ftrm.run())* All object's properties are handed over to the components factory except for ```opts.input``` and ```opts.output```. They are normalised before they are processed:

 * ```{input: 'pipe-name'}``` -> ```{input: [{pipe: 'pipe-name'}]}```
 * ```{input: ['pipe1', 'pipe2']}``` -> ```{input: [{pipe: 'pipe1'}, {pipe: 'pipe1'}]}```
 * ```{input: {'name1': 'pipe1', 'name2': 'pipe2'}}``` -> ```{input: [{name: 'name1', pipe: 'pipe1'}, {name: 'name2', pipe: 'pipe1'}]}```

The same rules apply to the property ```output```. This may look a little bit complicated at first glance. But it helps to build components with an easy but also machine-readable interface.

## Method: component.check()

```js
component.check = (opts) => { ... };
```

This optional function is called after normalisation of ```opts``` and can check them. If an error is thrown are a rejected promised return, the instantiation will be aborted and the factory is not called.

## Method: component.factory()

```js
component.factory = (opts, input, output, bus) => { ... };
```

### Argument: opts

The first argument ```opts``` holds the options specified by the user.

### Argument: input

The ```input``` object is derived from the normalised ```opts.input``` array. Every input can always be accessed by its index, like an array. The index corresponds to the respective item's index in ```opts.input```. If the ```name``` property of the input is set, it can also by accessed by ```input[name]```.

Every input holds the most recent value in ```input[index].value``` together with ```input[index].timestamp``` as the point in time when the originating output set the value. *(If the local node's time drifts, the timestamp can't be compared with the local time! So make sure NTP is set up.)*

If the input's property ```expire``` has been specified, received values will expire after the specified amount of milliseconds. If current expiration state can be accessed by reading ```input[index].expired```.

Every input is an instance of the *EventEmitter*. Thus, they throw events:

```js
input[index].on('update', (value, timestamp) => {
	// Is emitted when something is written into the input's pipe
});

input[index].on('change', (value, timestamp) => {
	// Is emitted when something is written into the input's pipe and value has changed
});

input[index].on('expire', () => {
	// Is emitted when the hold value expired
});
```

### Argument: output

The ```output``` object is derived from the normalised ```opts.output``` array. Every output can always be accessed by its index, like an array. The index corresponds to the respective item's index in ```opts.output```. If the ```name``` property of the output is set, it can also by accessed by ```output[name]```.

The ```throttle``` property defines an interval in milliseconds. If the values is set multiple times within that interval and doesn't change, it will only be published once in the pipe. This feature may reduces noise in the system.

If ```output[index].value``` is written, the value will be put on the specified ```pipe``` together with the current timestamp. Alternatively, ```output[index].set(value, timestamp)``` can be called if setting the timestamp manually is required.

### Argument: bus

The local node's instance of [Partybus](https://github.com/jue89/node-partybus#readme).
