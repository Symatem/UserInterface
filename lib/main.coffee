SymatemIdeView = require './symatem-ide-view'
{CompositeDisposable} = require 'atom'

module.exports = SymatemIde =
  symatemIdeView: null
  subscriptions: null

  activate: (state) ->
    @symatemIdeView = new SymatemIdeView(state.symatemIdeViewState)
    @subscriptions = new CompositeDisposable
    @subscriptions.add atom.commands.add 'atom-workspace', 'symatem-ide:toggle': => @toggle()

  deactivate: ->
    @symatemIdeView.destroy()
    @subscriptions.dispose()

  serialize: ->
    symatemIdeViewState: @symatemIdeView.serialize()

  toggle: ->
    @symatemIdeView.toggle()
