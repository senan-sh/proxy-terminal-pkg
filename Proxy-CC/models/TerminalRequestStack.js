const http = require("http")

module.exports = class TerminalRequestStack {
  stack = [];

  pop = () => {
    this.stack.pop()
  }
  /**
   * 
   * @param {http.ClientRequest} request 
   */
  push = (request) => {
    this.stack.push(request);
  }

  cancelAll = () => {
    for (const request of this.stack) {
      try {
        request.destroy();
      } catch (err) {
        console.log("Couldn't close connection manually.")
      } finally {
        this.stack = [];
      }
    }
  }
}