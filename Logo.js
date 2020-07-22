import { Panel } from './node_modules/SvgPanels/Panel.js';

export class AnimatedLogoPanel extends Panel {
    constructor(position, size) {
        super(position, size, Panel.createElement('g'));
        this.circleRadius = Math.min(size[0], size[1])*0.485;
        this.fadeOutTime = 0.2;
        this.circleTime = 0.1;
        this.loopDelay = 0.025;
        this.loopCut = 0.355;
        this.node.setAttribute('fill', 'none');
        this.node.setAttribute('stroke', '#FFF');
        this.node.setAttribute('stroke-width', this.circleRadius*0.09);
        this.defsNode = Panel.createElement('defs', this.node);
        this.backgroundCircle = Panel.createElement('circle', this.defsNode);
        this.backgroundCircle.setAttribute('id', 'maskBackground');
        this.backgroundCircle.setAttribute('fill', '#FFF');
        this.backgroundCircle.setAttribute('r', this.circleRadius);
        this.paths = [];
        for(let i = 0; i < 3; ++i) {
            const path = Panel.createElement('path', this.defsNode);
            path.setAttribute('id', `maskPath${i}`);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', '#000');
            path.setAttribute('stroke-width', this.circleRadius*0.14);
            this.paths.push(path);
        }
        for(let i = 0; i < 3; ++i) {
            const mask = Panel.createElement('mask', this.defsNode);
            mask.setAttribute('id', `mask${i}`);
            mask.setAttribute('x', -this.circleRadius);
            mask.setAttribute('y', -this.circleRadius);
            mask.setAttribute('width', this.circleRadius*2);
            mask.setAttribute('height', this.circleRadius*2);
            const useA = Panel.createElement('use', mask);
            useA.setAttribute('href', '#maskBackground');
            const useB = Panel.createElement('use', mask);
            useB.setAttribute('href', `#maskPath${i}`);
            const useC = Panel.createElement('use', mask);
            useC.setAttribute('href', `#maskPath${(i+1)%3}`);
        }
        this.outerCircle = Panel.createElement('circle', this.node);
        for(let i = 0; i < 3; ++i) {
            const path = Panel.createElement('path', this.node);
            path.setAttribute('mask', `url(#mask${i})`);
            this.paths.push(path);
        }
        for(let i = 0; i < 3; ++i)
            for(let t = this.loopCut-0.015; t <= this.loopCut+0.015; t += 0.005)
                this.appendPoint(this.paths[i], i/3-t);
    }

    appendPoint(path, t) {
        const w = Math.E/(2*Math.PI),
              loopRadius = this.circleRadius*0.75,
              angle = Math.PI*2*t,
              posX = (w*Math.sin(angle)+(1-w)*Math.sin(2*angle))*loopRadius,
              posY = (w*Math.cos(angle)-(1-w)*Math.cos(2*angle))*loopRadius;
        let data = path.getAttribute('d');
        data = (data) ? `${data}L` : 'M';
        path.setAttribute('d', `${data}${posX} ${posY}`);
    }

    animate(timeDiff) {
        if(this.t < this.circleTime)
            this.outerCircle.setAttribute('r', this.circleRadius*(this.t/this.circleTime));
        if(this.t > this.loopDelay+1/3)
            this.node.style.opacity = 1-(this.t-this.loopDelay-1/3)/this.fadeOutTime;
        else if(this.t > this.loopDelay)
            for(let i = 0; i < 3; ++i)
                this.appendPoint(this.paths[3+i], this.t-this.loopDelay+this.loopCut+(i-1)/3);
        if(this.t > this.loopDelay+1/3+this.fadeOutTime) {
            if(this.onend)
                this.onend();
            return false;
        }
        this.t += timeDiff*0.0002;
        return true;
    }

    startAnimation() {
        this.t = 0;
        this.node.style.opacity = 1;
        for(let i = 0; i < 3; ++i)
            this.paths[3+i].removeAttribute('d');
        Panel.animate(this.animate.bind(this));
    }
};
