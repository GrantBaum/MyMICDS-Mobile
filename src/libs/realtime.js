/**
 * @file Manages a bunch of miscellaneous realtime events
 * @module realtime
 */

module.exports = (io, socketIO) => {
	io.on('connection', socket => {
		socket.pressingProgressLabel = false;

		socket.on('progress label click', pressed => {
			socket.pressingProgressLabel = pressed;
			calcProgressSpin();
		});

		socket.on('disconnect', () => {
			socket.pressingProgressLabel = false;
			calcProgressSpin();
		})
	});

	/**
	 * Determines if anyone is currently pressing the progress label, and emits whether should or should not spin
	 * @function calcProgressSpin
	 */

	function calcProgressSpin() {
		var anyPressing = false;

		for(var index in io.sockets.connected) {
			var socket = io.sockets.connected[index];

			if(socket.pressingProgressLabel) {
				anyPressing = true;
				break;
			}
		}

		io.emit('progress label spin', anyPressing);
	}
}
