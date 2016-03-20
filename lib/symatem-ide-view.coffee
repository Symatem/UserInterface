{Point, Range} = require 'atom'

module.exports =
  class SymatemIDEView
    lineHeight: 26
    showReverse: null
    showSymbolIDs: null
    showDeadEnds: null
    svg: null
    focusedSymbol: 0
    symbolNames:
      0: 'Car'
      1: 'Has'
      2: 'Engine'
    triples: [
      [0, 1, 2]
    ]
    boxes: []
    connections: []

    nameOfSymbol: (symbol) ->
      if @showSymbolIDs.checked
        return '#'+symbol
      else
        return @symbolNames[symbol]

    focusSymbol: (symbol) ->
      @focusedSymbol = symbol
      this.render()

    render: (dumpAll) ->
      trash = @connections.slice()
      @newBoxes = {}
      @symbolsToShow = [0, 1, 2]

      for symbol,box of @boxes
        if !dumpAll && parseInt(symbol) in @symbolsToShow
          box.animation.setAttribute('from', box.x+','+box.y)
          box.setPosition(parseInt(symbol) == @focusedSymbol)
          box.animation.setAttribute('to', box.x+','+box.y)
          box.animation.beginElement()
          box.group.setAttribute('transform', 'translate('+box.x+','+box.y+')')
        else
          trash.push(box.group)
          delete @boxes[symbol]

      for symbol,position of @symbolsToShow
        if !@boxes[symbol]
          @newBoxes[symbol] = { segments: [] }

      for triple in @triples
        @entity = @newBoxes[triple[0]]
        if @entity
          @entity.segments.push(
            leftType: 1, rightType: 2, leftSymbol: triple[1], rightSymbol: triple[2]
          )
        if @showReverse.checked
          @attribute = @newBoxes[triple[1]]
          if @attribute
            @attribute.segments.push(
              leftType: 2, rightType: 0, leftSymbol: triple[2], rightSymbol: triple[0]
            )
          @value = @newBoxes[triple[2]]
          if @value
            @value.segments.push(
              leftType: 0, rightType: 1, leftSymbol: triple[0], rightSymbol: triple[1]
            )

      for symbol,box of @newBoxes
        this.createBox(parseInt(symbol), box)

      this.updateNames()
      for symbol,box of @boxes
        for i,segment of box.segments
          @otherBox = @boxes[segment.leftSymbol]
          if @otherBox
            this.renderConnection(segment.leftCircle, @otherBox.circle, segment.leftType)
          @otherBox = @boxes[segment.rightSymbol]
          if @otherBox
            this.renderConnection(segment.rightCircle, @otherBox.circle, segment.rightType)

      for element in trash
        element.classList.remove('fadeIn')
        element.classList.add('fadeOut')
      window.setTimeout(->
        for element in trash
          element.remove()
      , 200)

    renderConnection: (from, to, type) ->
      from = from.getAbsolutePosition()
      to = to.getAbsolutePosition()
      @connection = document.createElementNS(@svg.namespaceURI, 'path')
      if Math.abs(from[0]-to[0]) < Math.abs(from[1]-to[1])
        @connection.setAttribute('d', 'M'+from[0]+','+from[1]+'C'+to[0]+','+from[1]+' '+from[0]+','+to[1]+' '+to[0]+','+to[1])
      else
        @connection.setAttribute('d', 'M'+from[0]+','+from[1]+'C'+from[0]+','+to[1]+' '+to[0]+','+from[1]+' '+to[0]+','+to[1])
      @connection.setAttribute('class', 'connection fadeIn colorType'+type)
      @svg.appendChild(@connection)
      @connections.push(@connection)

    updateNames: ->
      for symbol,box of @boxes
        box.nameElement.textContent = this.nameOfSymbol(symbol)
        for segment in box.segments
          segment.leftElement.textContent = this.nameOfSymbol(segment.leftSymbol)
          segment.rightElement.textContent = this.nameOfSymbol(segment.rightSymbol)

    createBox: (symbol, box) ->
      box.width = 200
      box.height = 2+(box.segments.length+1)*@lineHeight
      box.setPosition = (isFocused) ->
        if isFocused
          box.x = 500
          box.y = 50
        else
          box.x = 500+Math.cos(symbol/2*Math.PI)*300
          box.y = 50+Math.sin(symbol/2*Math.PI)*100
      box.setPosition(symbol == @focusedSymbol)
      @boxes[symbol] = box

      @getAbsolutePosition = ->
        return [box.x+parseInt(this.getAttribute('cx')), box.y+parseInt(this.getAttribute('cy'))]

      box.group = document.createElementNS(@svg.namespaceURI, 'g')
      box.group.setAttribute('class', 'fadeIn')
      box.group.setAttribute('transform', 'translate('+box.x+','+box.y+')')
      @svg.appendChild(box.group)

      box.animation = document.createElementNS(@svg.namespaceURI, 'animateTransform')
      box.animation.setAttribute('attributeName', 'transform')
      box.animation.setAttribute('type', 'translate')
      box.animation.setAttribute('dur', '0.2s')
      box.group.appendChild(box.animation)

      @rect = document.createElementNS(@svg.namespaceURI, 'rect')
      @rect.setAttribute('rx', 10)
      @rect.setAttribute('ry', 10)
      @rect.setAttribute('width', box.width)
      @rect.setAttribute('height', box.height)
      box.group.appendChild(@rect)

      box.circle = document.createElementNS(@svg.namespaceURI, 'circle')
      box.circle.setAttribute('cx', box.width/2)
      box.circle.setAttribute('cy', -10)
      box.circle.setAttribute('r', 5)
      box.circle.getAbsolutePosition = @getAbsolutePosition.bind(box.circle)
      box.group.appendChild(box.circle)

      box.nameElement = document.createElementNS(@svg.namespaceURI, 'text')
      box.nameElement.setAttribute('text-anchor', 'middle')
      box.nameElement.setAttribute('x', box.width/2)
      box.nameElement.setAttribute('y', 20)
      box.nameElement.addEventListener('click', this.focusSymbol.bind(this, symbol))
      box.group.appendChild(box.nameElement)

      for i,segment of box.segments
        @line = document.createElementNS(@svg.namespaceURI, 'path')
        @line.setAttribute('d', 'M0 '+(28+@lineHeight*i)+'H'+box.width)
        box.group.appendChild(@line)

        @left = document.createElementNS(@svg.namespaceURI, 'text')
        @left.setAttribute('text-anchor', 'start')
        @left.setAttribute('x', 25)
        @left.setAttribute('y', 46+@lineHeight*i)
        @left.addEventListener('click', this.focusSymbol.bind(this, segment.leftSymbol))
        box.group.appendChild(@left)
        segment.leftElement = @left

        @right = document.createElementNS(@svg.namespaceURI, 'text')
        @right.setAttribute('text-anchor', 'end')
        @right.setAttribute('x', box.width-25)
        @right.setAttribute('y', 46+@lineHeight*i)
        @right.addEventListener('click', this.focusSymbol.bind(this, segment.rightSymbol))
        box.group.appendChild(@right)
        segment.rightElement = @right

        segment.leftCircle = document.createElementNS(@svg.namespaceURI, 'circle')
        segment.leftCircle.setAttribute('cx', 13)
        segment.leftCircle.setAttribute('cy', 41+@lineHeight*i)
        segment.leftCircle.setAttribute('r', 5)
        segment.leftCircle.setAttribute('class', 'colorType'+segment.leftType)
        segment.leftCircle.getAbsolutePosition = @getAbsolutePosition.bind(segment.leftCircle)
        box.group.appendChild(segment.leftCircle)

        segment.rightCircle = document.createElementNS(@svg.namespaceURI, 'circle')
        segment.rightCircle.setAttribute('cx', box.width-13)
        segment.rightCircle.setAttribute('cy', 41+@lineHeight*i)
        segment.rightCircle.setAttribute('r', 5)
        segment.rightCircle.setAttribute('class', 'colorType'+segment.rightType)
        segment.rightCircle.getAbsolutePosition = @getAbsolutePosition.bind(segment.rightCircle)
        box.group.appendChild(segment.rightCircle)

    constructor: (serializedState) ->
      @element = document.createElement('div')
      @element.setAttribute('class', 'symatem-ide-view')
      @panel = atom.workspace.addBottomPanel(item: @element, visible: false)

      @svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      @element.appendChild(@svg)
      @svgDefs = document.createElementNS(@svg.namespaceURI, 'defs')
      @svg.appendChild(@svgDefs)
      @arrowMarker = document.createElementNS(@svg.namespaceURI, 'marker')
      @arrowMarker.setAttribute('id', 'arrow')
      @arrowMarker.setAttribute('markerWidth', 7)
      @arrowMarker.setAttribute('markerHeight', 6)
      @arrowMarker.setAttribute('refX', 6)
      @arrowMarker.setAttribute('refY', 3)
      @arrowMarker.setAttribute('orient', 'auto')
      @svgDefs.appendChild(@arrowMarker)
      @arrowPath = document.createElementNS(@svg.namespaceURI, 'path')
      @arrowPath.setAttribute('d', 'M0,1L5,3L0,5z')
      @arrowMarker.appendChild(@arrowPath)

      @options = document.createElement('div')
      @options.setAttribute('class', 'options')
      @element.appendChild(@options)

      @optionsTable = document.createElement('table')
      @options.appendChild(@optionsTable)

      @optionsTableRow = document.createElement('tr')
      @optionsTable.appendChild(@optionsTableRow)
      @optionsTableCell = document.createElement('td')
      @optionsTableCell.setAttribute('width', 80)
      @optionsTableCell.innerText = 'Reverse'
      @optionsTableRow.appendChild(@optionsTableCell)
      @optionsTableCell = document.createElement('td')
      @optionsTableRow.appendChild(@optionsTableCell)
      @showReverse = document.createElement('input')
      @showReverse.setAttribute('type', 'checkbox')
      @showReverse.addEventListener('click', this.render.bind(this, true))
      @optionsTableCell.appendChild(@showReverse)

      @optionsTableRow = document.createElement('tr')
      @optionsTable.appendChild(@optionsTableRow)
      @optionsTableCell = document.createElement('td')
      @optionsTableCell.innerText = 'Symbol IDs'
      @optionsTableRow.appendChild(@optionsTableCell)
      @optionsTableCell = document.createElement('td')
      @optionsTableRow.appendChild(@optionsTableCell)
      @showSymbolIDs = document.createElement('input')
      @showSymbolIDs.setAttribute('type', 'checkbox')
      @showSymbolIDs.addEventListener('click', this.updateNames.bind(this))
      @optionsTableCell.appendChild(@showSymbolIDs)

      @optionsTableRow = document.createElement('tr')
      @optionsTable.appendChild(@optionsTableRow)
      @optionsTableCell = document.createElement('td')
      @optionsTableCell.innerText = 'Dead Ends'
      @optionsTableRow.appendChild(@optionsTableCell)
      @optionsTableCell = document.createElement('td')
      @optionsTableRow.appendChild(@optionsTableCell)
      @showDeadEnds = document.createElement('input')
      @showDeadEnds.setAttribute('type', 'checkbox')
      @showDeadEnds.setAttribute('checked', 'on')
      @showDeadEnds.addEventListener('click', this.render.bind(this, true))
      @optionsTableCell.appendChild(@showDeadEnds)

      this.focusSymbol(1)

    toggle: ->
      if @panel.isVisible()
        @panel.hide()
      else
        @panel.show()

    serialize: ->

    destroy: ->
      @element.remove()

    remove: ->
      super
      @element.destroy()
      @panel.destroy()
