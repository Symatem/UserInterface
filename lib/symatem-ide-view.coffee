{Point, Range} = require 'atom'

module.exports =
  class SymatemIDEView
    lineHeight: 26
    svg: null
    showEAVOnly: null
    showAnonymousOnly: null
    showHangingLines: null
    showSymbolIDs: null
    historyElement: null
    history: []
    focusedSymbol: 1485
    symbolNames:
      13: 'Procedure'
      14: 'Execute'
      15: 'Next'
      16: 'Static'
      17: 'Dynamic'
      18: 'Input'
      19: 'Output'
      23: 'Count'
      32: 'Create'
      35: 'Pop'
      36: 'Branch'
      54: 'CloneBlob'
      62: 'LessThan'
      64: 'Comparandum'
      72: 'Add'
      74: 'Subtract'
      75: 'Minuend'
      76: 'Subtrahend'
      1485: 'FiboRec'
      1590: '#a'
      1601: '#b'
      1816: 2
      2775: 1
    triples: [
      [1485, 14, 1537],
      [1537, 13, 32],
      [1612, 19, 1590],
      [1612, 19, 1601],
      [1537, 16, 1612],
      [1537, 15, 1691],
      [1691, 13, 62],
      [1743, 19, 1590],
      [1743, 18, 18],
      [1691, 17, 1743],
      [1831, 64, 1816],
      [1691, 16, 1831],
      [1691, 15, 1902],
      [1902, 13, 36],
      [1952, 18, 1590],
      [1902, 17, 1952],
      [2024, 13, 54],
      [2069, 18, 18],
      [2069, 19, 19],
      [2024, 17, 2069],
      [2024, 15, 2148],
      [2148, 13, 35],
      [2211, 23, 1816],
      [2148, 16, 2211],
      [2256, 36, 2024],
      [1902, 16, 2256],
      [1902, 15, 2327],
      [2327, 13, 74],
      [2377, 19, 1590],
      [2377, 75, 18],
      [2327, 17, 2377],
      [2462, 76, 1816],
      [2327, 16, 2462],
      [2327, 15, 2531],
      [2531, 13, 1485],
      [2581, 19, 1590],
      [2581, 18, 1590],
      [2531, 17, 2581],
      [2531, 15, 2660],
      [2660, 13, 74],
      [2708, 19, 1601],
      [2708, 75, 18],
      [2660, 17, 2708],
      [2790, 76, 2775],
      [2660, 16, 2790],
      [2660, 15, 2859],
      [2859, 13, 1485],
      [2907, 19, 1601],
      [2907, 18, 1601],
      [2859, 17, 2907],
      [2859, 15, 2990],
      [2990, 13, 72],
      [3040, 19, 19],
      [3040, 18, 1590],
      [3040, 18, 1601],
      [2990, 17, 3040]
    ]
    boxes: []
    connections: []

    focusSymbol: (symbol) ->
      @focusedSymbol = symbol
      @index = @history.indexOf(symbol)
      if @index > -1
        for i in [@index+1...@history.length]
          @historyElement.removeChild(@historyElement.childNodes[@index+1])
        @history.splice(@index+1)
      else
        element = document.createElementNS(@svg.namespaceURI, 'text')
        element.setAttribute('x', 10+@history.length*100)
        element.setAttribute('y', 23)
        element.addEventListener('click', this.focusSymbol.bind(this, symbol))
        @historyElement.appendChild(element)
        @history.push(symbol)
      this.render(false)

    render: (dumpAll) ->
      trash = @connections.slice()

      @newBoxes = {}
      @symbolsToShow = [@focusedSymbol]
      @addSymbolsToShow = (symbol) ->
        if @showAnonymousOnly.checked and @symbolNames[symbol]
          return
        if symbol not in @symbolsToShow
          @symbolsToShow.push(symbol)

      for triple in @triples
        if triple[0] == @focusedSymbol
          @addSymbolsToShow(triple[1])
          @addSymbolsToShow(triple[2])
        if triple[1] == @focusedSymbol
          @addSymbolsToShow(triple[2])
          @addSymbolsToShow(triple[0])
        if triple[2] == @focusedSymbol
          @addSymbolsToShow(triple[0])
          @addSymbolsToShow(triple[1])

      for symbol in @symbolsToShow
        if dumpAll || !@boxes[symbol]
          @newBoxes[symbol] = { segments: [] }

      for triple in @triples
        @entity = @newBoxes[triple[0]]
        if @entity
          @entity.segments.push(
            leftType: 1, rightType: 2, leftSymbol: triple[1], rightSymbol: triple[2]
          )
        if !@showEAVOnly.checked
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

      for symbol,box of @boxes
        symbol = parseInt(symbol)
        if !dumpAll && symbol in @symbolsToShow
          box.setPosition(symbol == @focusedSymbol, @symbolsToShow)
        else
          trash.push(box.group)
          delete @boxes[symbol]

      for symbol,box of @newBoxes
        symbol = parseInt(symbol)
        this.createBox(symbol, box)
        box.setPosition(symbol == @focusedSymbol, @symbolsToShow)

      this.updateNames()

      for symbol,box of @boxes
        symbol = parseInt(symbol)
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
      , 250)

    renderConnection: (from, to, type) ->
      from = from.getAbsolutePosition()
      to = to.getAbsolutePosition()
      @connection = document.createElementNS(@svg.namespaceURI, 'path')
      if @showHangingLines.checked
        @diffX = to[0]-from[0]
        @maxY = Math.max(to[1], from[1])+20
        @connection.setAttribute('d', 'M'+from[0]+','+from[1]+'C'+(from[0]+@diffX*0.25)+','+@maxY+' '+(from[0]+@diffX*0.75)+','+@maxY+' '+to[0]+','+to[1])
      else
        if Math.abs(from[0]-to[0]) < Math.abs(from[1]-to[1])
          @connection.setAttribute('d', 'M'+from[0]+','+from[1]+'C'+to[0]+','+from[1]+' '+from[0]+','+to[1]+' '+to[0]+','+to[1])
        else
          @connection.setAttribute('d', 'M'+from[0]+','+from[1]+'C'+from[0]+','+to[1]+' '+to[0]+','+from[1]+' '+to[0]+','+to[1])
      @connection.setAttribute('class', 'connection fadeIn colorType'+type)
      @svg.appendChild(@connection)
      @connections.push(@connection)

    elementUpdateName: (element, symbol) ->
      if @showSymbolIDs.checked
        element.setAttribute('fill', 'white')
        element.textContent = '#'+symbol
        return

      element.textContent = @symbolNames[symbol]
      if element.textContent
        element.setAttribute('fill', 'white')
      else
        element.setAttribute('fill', 'gray')
        element.textContent = '#'+symbol

    updateNames: ->
      for index,symbol of @history
        this.elementUpdateName(@historyElement.childNodes[index], symbol)
      for symbol,box of @boxes
        this.elementUpdateName(box.nameElement, symbol)
        for segment in box.segments
          this.elementUpdateName(segment.leftElement, segment.leftSymbol)
          this.elementUpdateName(segment.rightElement, segment.rightSymbol)

    createBox: (symbol, box) ->
      box.width = 200
      box.height = 2+(box.segments.length+1)*@lineHeight
      box.setPosition = (isFocused, symbolsToShow) ->
        @prevX = box.x
        @prevY = box.y
        if isFocused
          box.x = 600-box.width/2
          box.y = 50
        else
          @maxIndex = symbolsToShow.length-2
          @index = symbolsToShow.indexOf(symbol)-1
          @angleTable = [[Math.PI/2], [Math.PI/3, Math.PI/3*2], [Math.PI/4, Math.PI/4*2, Math.PI/4*3]]
          if @maxIndex < @angleTable.length
            @angle = @angleTable[@maxIndex][@index]
          else
            @angle = @index/@maxIndex*Math.PI
          box.x = Math.cos(@angle)*450+600-box.width/2
          box.y = Math.sin(@angle)*250+50
        if @prevX
          box.animation.setAttribute('from', @prevX+','+@prevY)
        else
          box.animation.setAttribute('from', box.x+','+box.y)
        box.animation.setAttribute('to', box.x+','+box.y)
        box.animation.beginElement()
      @boxes[symbol] = box

      @getAbsolutePosition = ->
        return [box.x+parseInt(this.getAttribute('cx')), box.y+parseInt(this.getAttribute('cy'))]

      box.group = document.createElementNS(@svg.namespaceURI, 'g')
      box.group.setAttribute('class', 'fadeIn')
      @svg.appendChild(box.group)

      box.animation = document.createElementNS(@svg.namespaceURI, 'animateTransform')
      box.animation.setAttribute('attributeName', 'transform')
      box.animation.setAttribute('fill', 'freeze')
      box.animation.setAttribute('type', 'translate')
      box.animation.setAttribute('dur', '0.25s')
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

      @historyElement = document.createElementNS(@svg.namespaceURI, 'g')
      @svg.appendChild(@historyElement)

      @options = document.createElement('div')
      @options.setAttribute('class', 'options')
      @element.appendChild(@options)

      @options.appendChild(document.createTextNode('EAV only: '))
      @showEAVOnly = document.createElement('input')
      @showEAVOnly.setAttribute('type', 'checkbox')
      @showEAVOnly.setAttribute('checked', 'on')
      @showEAVOnly.addEventListener('click', this.render.bind(this, true))
      @options.appendChild(@showEAVOnly)

      @options.appendChild(document.createElement('br'))
      @options.appendChild(document.createTextNode('Anon only: '))
      @showAnonymousOnly = document.createElement('input')
      @showAnonymousOnly.setAttribute('type', 'checkbox')
      @showAnonymousOnly.setAttribute('checked', 'on')
      @showAnonymousOnly.addEventListener('click', this.render.bind(this, false))
      @options.appendChild(@showAnonymousOnly)

      @options.appendChild(document.createElement('br'))
      @options.appendChild(document.createTextNode('Hanging: '))
      @showHangingLines = document.createElement('input')
      @showHangingLines.setAttribute('type', 'checkbox')
      @showHangingLines.addEventListener('click', this.render.bind(this, false))
      @options.appendChild(@showHangingLines)

      @options.appendChild(document.createElement('br'))
      @options.appendChild(document.createTextNode('Symbol IDs: '))
      @showSymbolIDs = document.createElement('input')
      @showSymbolIDs.setAttribute('type', 'checkbox')
      @showSymbolIDs.addEventListener('click', this.updateNames.bind(this))
      @options.appendChild(@showSymbolIDs)

      this.focusSymbol(@focusedSymbol)

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
