for(const ul of document.getElementsByTagName('ul')) {
    const li = (ul.parentNode.tagName == 'LI') ? ul.parentNode : undefined;
    if(li)
        li.classList.add('open');
    ul.setAttribute('height', ul.offsetHeight);
    if(li)
        li.classList.remove('open');
    ul.style.height = (li) ? 0 : ul.offsetHeight;
    if(!li)
        continue;
    li.childNodes[0].onclick = function(event) {
        let height = parseInt(ul.getAttribute('height'));
        const close = li.classList.contains('open');
        if(close)
            li.classList.remove('open');
        else
            li.classList.add('open');
        ul.style.height = (close) ? 0 : height;
        if(close)
            height *= -1;
        for(let parent = li.parentNode; parent.tagName === 'UL'; parent = parent.parentNode.parentNode) {
            const value = parseInt(parent.getAttribute('height'))+height;
            parent.setAttribute('height', value);
            parent.style.height = value;
        }
        event.stopPropagation();
    };
}
