sigma = require 'sigma'

module.exports =
class SymatemIdeView
  graph: null

  constructor: (serializedState) ->
    # Create root element
    @element = document.createElement('div')
    @element.classList.add('symatem-ide')

    # Create message element
    @graph = document.createElement('div')

    @graph.classList.add('graph')
    @element.appendChild(@graph)

  # Returns an object that can be retrieved when package is activated
  serialize: ->

  # Tear down any state and detach
  destroy: ->
    @element.remove()

  getElement: ->
    @element
