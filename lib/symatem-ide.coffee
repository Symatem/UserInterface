SymatemIdeView = require './symatem-ide-view'
{CompositeDisposable} = require 'atom'

module.exports = SymatemIde =
  symatemIdeView: null
  idePanel: null
  subscriptions: null
  
  activate: (state) ->
    @symatemIdeView = new SymatemIdeView(state.symatemIdeViewState)
    @idePanel = atom.workspace.addBottomPanel(item: @symatemIdeView.getElement(), visible: false)

    # Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    @subscriptions = new CompositeDisposable

    # Register command that toggles this view
    @subscriptions.add atom.commands.add 'atom-workspace', 'symatem-ide:toggle': => @toggle()

  deactivate: ->
    @idePanel.destroy()
    @subscriptions.dispose()
    @symatemIdeView.destroy()

  serialize: ->
    symatemIdeViewState: @symatemIdeView.serialize()

  toggle: ->
    console.log 'SymatemIde was toggled!'

    if @idePanel.isVisible()
      @idePanel.hide()
    else
      @idePanel.show()
