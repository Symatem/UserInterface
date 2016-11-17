'use strict';

module.exports.initializerFunction = '_GLOBAL__sub_I_';
module.exports.chunkSize = 65536;
module.exports.blobBufferSize = 4096;
module.exports.symbols = []; // TODO
module.exports.symbolByName = {
    BlobType: 13,
    Natural: 14,
    Integer: 15,
    Float: 16,
    UTF8: 17
};


module.exports.env = {
    'consoleLogString': function(basePtr, length) {
        console.log(module.exports.uint8ArrayToString(module.exports.getMemorySlice(basePtr, length)));
    },
    'consoleLogInteger': function(basePtr) {
        console.log(new DataView(module.exports.wasmInstance.exports.memory.buffer).getInt32(basePtr, true));
    },
    'consoleLogFloat': function(basePtr) {
        console.log(new DataView(module.exports.wasmInstance.exports.memory.buffer).getFloat64(basePtr, true));
    }
};

module.exports.stringToUint8Array = function(string) {
    const array = [];
    for(var i = 0; i < string.length; ++i)
        array.push(string[i].charCodeAt(0));
    return new Uint8Array(array);
};

module.exports.uint8ArrayToString = function(array) {
    return String.fromCharCode.apply(null, array);
};

module.exports.getMemorySlice = function(begin, length) {
    return new Uint8Array(module.exports.wasmInstance.exports.memory.buffer.slice(begin, begin+length));
};

module.exports.setMemorySlice = function(begin, slice) {
    new Uint8Array(module.exports.wasmInstance.exports.memory.buffer).set(slice, begin);
};

module.exports.call = function(name, ...params) {
    try {
        return module.exports.wasmInstance.exports[name](...params);
    } catch(error) {
        console.log(name, error);
    }
};

module.exports.readSymbolBlob = function(symbol) {
    return new Uint32Array(module.exports.readBlob(symbol).buffer);
}

module.exports.readBlob = function(symbol, offset, length) {
    if(!offset)
        offset = 0;
    if(!length)
        length = module.exports.call('getBlobSize', symbol)-offset;
    if(length < 0)
        return;
    let sliceOffset = 0;
    const bufferByteAddress = module.exports.call('getStackPointer')-module.exports.blobBufferSize,
          data = new Uint8Array(Math.ceil(length/8));
    while(length > 0) {
        const sliceLength = Math.min(length, module.exports.blobBufferSize*8);
        module.exports.call('readBlob', symbol, offset+sliceOffset*8, sliceLength);
        const bufferSlice = module.exports.getMemorySlice(bufferByteAddress+sliceOffset, Math.ceil(sliceLength/8));
        data.set(bufferSlice, sliceOffset);
        length -= sliceLength;
        sliceOffset += Math.ceil(sliceLength/8);
    }
    return data;
};

module.exports.writeBlob = function(data, symbol, offset) {
    const bufferByteAddress = module.exports.call('getStackPointer')-module.exports.blobBufferSize;
    let length = module.exports.call('getBlobSize', symbol), sliceOffset = 0;
    if(!offset) {
        offset = 0;
        module.exports.call('setBlobSize', symbol, data.length*8);
    } else if(offset+data.length*8 > length)
        return;
    length = data.length*8;
    while(length > 0) {
        const sliceLength = Math.min(length, module.exports.blobBufferSize*8);
        const bufferSlice = new Uint8Array(data.slice(sliceOffset, sliceOffset+Math.ceil(sliceLength/8)));
        module.exports.setMemorySlice(bufferByteAddress+sliceOffset, bufferSlice);
        module.exports.call('writeBlob', symbol, offset+sliceOffset*8, sliceLength);
        length -= sliceLength;
        sliceOffset += Math.ceil(sliceLength/8);
    }
};

module.exports.deserialize = function(inputString, packageSymbol = 0) {
    const inputSymbol = module.exports.call('createSymbol'), outputSymbol = module.exports.call('createSymbol');
    module.exports.writeBlob(module.exports.stringToUint8Array(inputString), inputSymbol);
    module.exports.call('link', inputSymbol, module.exports.symbolByName.BlobType, module.exports.symbolByName.UTF8);
    const exception = module.exports.call('deserializeBlob', inputSymbol, outputSymbol, packageSymbol);
    const result = module.exports.readSymbolBlob(outputSymbol);
    module.exports.call('releaseSymbol', inputSymbol);
    module.exports.call('releaseSymbol', outputSymbol);
    return (exception) ? exception : result;
};

module.exports.queryMode = ['M', 'V', 'I'];
module.exports.queryMask = {};
for(let i = 0; i < 27; ++i)
    module.exports.queryMask[module.exports.queryMode[i%3] + module.exports.queryMode[Math.floor(i/3)%3] + module.exports.queryMode[Math.floor(i/9)%3]] = i;

module.exports.query = function(mask, entity, attribute, value, countOnly) {
    const resultSymbol = (countOnly) ? 0 : module.exports.call('createSymbol');
    let result = module.exports.call('query', mask, entity, attribute, value, resultSymbol);
    if(!countOnly) {
        result = module.exports.readSymbolBlob(resultSymbol);
        module.exports.call('releaseSymbol', resultSymbol);
    }
    return result;
};

module.exports.initImage = function(code) {
    return WebAssembly.compile(code).then(function(result) {
        module.exports.wasmModule = result;
        module.exports.wasmInstance = new WebAssembly.Instance(module.exports.wasmModule, { 'env': module.exports.env });
        module.exports.superPageByteAddress = module.exports.wasmInstance.exports.memory.buffer.byteLength;
        module.exports.call(module.exports.initializerFunction+'WASM.cpp');
    }, function(error) {
        console.log(error);
    });
};

module.exports.saveImage = function() {
    return module.exports.wasmInstance.exports.memory.buffer.slice(module.exports.superPageByteAddress);
};

module.exports.loadImage = function(image) {
    const currentSize = module.exports.wasmInstance.exports.memory.buffer.byteLength,
          newSize = module.exports.superPageByteAddress+image.byteLength;
    if(currentSize < newSize)
        module.exports.wasmInstance.exports.memory.grow(math.ceil((newSize-currentSize)/module.exports.chunkSize));
    module.exports.setMemorySlice(module.exports.superPageByteAddress, image);
};
