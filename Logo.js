import { Panel } from './node_modules/SvgPanels/Panel.js';

export class AnimatedLogoPanel extends Panel {
    constructor(position, size) {
        super(position, size, Panel.createElement('g'));
        this.circleRadius = Math.min(size[0], size[1])*0.485;
        this.loopRadius = this.circleRadius*0.75;
        this.fadeOutTime = 0.3;
        this.circleTime = 0.3;
        this.loopDelay = 0.05;
        this.loopCut = 0.355;
        this.loopResolution = 70;
        this.speed = 0.00075;
        this.node.setAttribute('fill', 'none');
        this.node.setAttribute('stroke', '#FFF');
        this.node.setAttribute('stroke-width', this.circleRadius*0.09);
        this.defsNode = Panel.createElement('defs', this.node);
        this.backgroundCircle = Panel.createElement('circle', this.defsNode);
        this.backgroundCircle.setAttribute('id', 'maskBackground');
        this.backgroundCircle.setAttribute('fill', '#FFF');
        this.backgroundCircle.setAttribute('r', this.circleRadius);
        this.paths = [
            Panel.createElement('path', this.defsNode),
            Panel.createElement('path', this.defsNode)
        ];
        this.paths[0].setAttribute('id', 'maskPath');
        this.paths[0].setAttribute('fill', 'none');
        this.paths[0].setAttribute('stroke', '#000');
        this.paths[0].setAttribute('stroke-width', this.circleRadius*0.14);
        this.paths[1].setAttribute('id', 'path');
        const mask = Panel.createElement('mask', this.defsNode);
        mask.setAttribute('id', `mask`);
        mask.setAttribute('x', -this.circleRadius);
        mask.setAttribute('y', -this.circleRadius);
        mask.setAttribute('width', this.circleRadius*2);
        mask.setAttribute('height', this.circleRadius*2);
        const useA = Panel.createElement('use', mask);
        useA.setAttribute('href', '#maskBackground');
        const useB = Panel.createElement('use', mask);
        useB.setAttribute('href', `#maskPath`);
        const useC = Panel.createElement('use', mask);
        useC.setAttribute('href', `#maskPath`);
        useC.setAttribute('transform', `rotate(120)`);
        for(let i = 0; i < 3; ++i) {
            const path = Panel.createElement('use', this.node);
            path.setAttribute('href', '#path');
            path.setAttribute('transform', `rotate(${i*120})`);
            path.setAttribute('mask', `url(#mask)`);
        }
        this.outerCircle = Panel.createElement('circle', this.node);
        this.pointCount = Math.floor(-0.175*this.loopResolution);
        while(this.pointCount < Math.ceil(-0.06*this.loopResolution))
            this.appendPoint(0);
    }

    appendPoint(pathIndex) {
        const w = Math.E/(2*Math.PI),
              angle = Math.PI*2*(this.pointCount/(this.loopResolution*3)+this.loopCut),
              posX = (w*Math.sin(angle)+(1-w)*Math.sin(2*angle))*this.loopRadius,
              posY = (w*Math.cos(angle)-(1-w)*Math.cos(2*angle))*this.loopRadius,
              data = this.paths[pathIndex].getAttribute('d');
        this.paths[pathIndex].setAttribute('d', `${data ? data : ''}${data ? 'L' : 'M'}${posX} ${posY}`);
        ++this.pointCount;
    }

    animate(timeDiff) {
        this.outerCircle.setAttribute('r', this.circleRadius*Math.min(1.0, this.t/this.circleTime));
        if(this.t > this.loopDelay)
            while(this.pointCount <= Math.ceil(Math.min(1.0, this.t-this.loopDelay)*this.loopResolution))
                this.appendPoint(1);
        if(this.t > this.loopDelay+1)
            this.node.style.opacity = 1-(this.t-this.loopDelay-1)/this.fadeOutTime;
        if(this.t > this.loopDelay+1+this.fadeOutTime) {
            if(this.onend)
                this.onend();
            return false;
        }
        this.t += this.speed*timeDiff;
        return true;
    }

    startAnimation() {
        this.t = 0;
        this.pointCount = 0;
        this.node.style.opacity = 1;
        this.paths[1].removeAttribute('d');
        Panel.animate(this.animate.bind(this));
    }
};
