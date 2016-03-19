{Point, Range} = require 'atom'

module.exports =
  class SymatemIDEView
    svg: null

    addBox: (symbol, entity, attributes) ->
      @lineHeight = 26
      @boxWidth = 200

      @group = document.createElementNS(@svg.namespaceURI, 'g')
      @group.setAttribute('id', 'symbol'+symbol)
      @group.setAttribute('transform', 'translate(50,50)')
      @svg.appendChild(@group)

      # @animation = document.createElementNS(@svg.namespaceURI, 'animateTransform')
      # @animation.setAttribute('attributeName', 'transform')
      # @animation.setAttribute('type', 'translate')
      # @animation.setAttribute('from', '50,50')
      # @animation.setAttribute('to', '250,50')
      # @animation.setAttribute('dur', '2s')
      # @animation.setAttribute('repeatCount', 'indefinite')
      # @group.appendChild(@animation)

      @rect = document.createElementNS(@svg.namespaceURI, 'rect')
      @rect.setAttribute('rx', 10)
      @rect.setAttribute('ry', 10)
      @rect.setAttribute('width', @boxWidth)
      @rect.setAttribute('height', 2+(attributes.length+1)*@lineHeight)
      @group.appendChild(@rect)

      @text = document.createElementNS(@svg.namespaceURI, 'text')
      @text.setAttribute('x', 10)
      @text.setAttribute('y', 20)
      @text.textContent = entity
      @group.appendChild(@text)

      for i in [0...attributes.length]
        @text = document.createElementNS(@svg.namespaceURI, 'text')
        @text.setAttribute('x', 10)
        @text.setAttribute('y', 46+@lineHeight*i)
        @text.textContent = attributes[i]
        @group.appendChild(@text)

        @line = document.createElementNS(@svg.namespaceURI, 'path')
        @line.setAttribute('d', 'M0 '+(28+@lineHeight*i)+'H'+@boxWidth)
        @group.appendChild(@line)

        @circle = document.createElementNS(@svg.namespaceURI, 'circle')
        @circle.setAttribute('cx', @boxWidth-13)
        @circle.setAttribute('cy', 41+@lineHeight*i)
        @circle.setAttribute('r', 5)
        @group.appendChild(@circle)

    constructor: (serializedState) ->
      @svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      @svgDefs = document.createElementNS(@svg.namespaceURI, 'defs')
      @svg.appendChild(@svgDefs)
      @arrowMarker = document.createElementNS(@svg.namespaceURI, 'marker')
      @arrowMarker.setAttribute('id', 'arrow')
      @arrowMarker.setAttribute('markerWidth', '7px')
      @arrowMarker.setAttribute('markerHeight', '6px')
      @arrowMarker.setAttribute('refX', '0px')
      @arrowMarker.setAttribute('refY', '3px')
      @arrowMarker.setAttribute('orient', 'auto')
      @svgDefs.appendChild(@arrowMarker)
      @arrowPath = document.createElementNS(@svg.namespaceURI, 'path')
      @arrowPath.setAttribute('d', 'M0,1L5,3L0,5z')
      @arrowMarker.appendChild(@arrowPath)

      @element = document.createElement('div')
      @element.setAttribute('class', 'symatem-ide-view')
      @element.appendChild(@svg)
      @panel = atom.workspace.addBottomPanel(item: @element, visible: false)

      this.addBox(0, "Entity", ["Attribute 0", "Attribute 1", "Attribute 2", "Attribute 3"])

      @line = document.createElementNS(@svg.namespaceURI, 'path')
      @line.setAttribute('d', 'M237,91C337,91 337,200 437,200')
      @line.setAttribute('stroke-width', '2px')
      @line.setAttribute('class', 'arrow')
      @svg.appendChild(@line)

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
