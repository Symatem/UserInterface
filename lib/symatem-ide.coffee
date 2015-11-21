SymatemIdeView = require './symatem-ide-view'
{CompositeDisposable} = require 'atom'

module.exports = SymatemIde =
  symatemIdeView: null
  modalPanel: null
  subscriptions: null

  activate: (state) ->
    @symatemIdeView = new SymatemIdeView(state.symatemIdeViewState)
    @modalPanel = atom.workspace.addModalPanel(item: @symatemIdeView.getElement(), visible: false)

    # Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    @subscriptions = new CompositeDisposable

    # Register command that toggles this view
    @subscriptions.add atom.commands.add 'atom-workspace', 'symatem-ide:toggle': => @toggle()

  deactivate: ->
    @modalPanel.destroy()
    @subscriptions.dispose()
    @symatemIdeView.destroy()

  serialize: ->
    symatemIdeViewState: @symatemIdeView.serialize()

  toggle: ->
    console.log 'SymatemIde was toggled!'

    if @modalPanel.isVisible()
      @modalPanel.hide()
    else
      @modalPanel.show()
