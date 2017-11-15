export default class FuzzySearchIndex {
    constructor() {
        this.trigramIndex = new Map();
    }

    add(entry) {
        for(let i = 0; i < entry.label.length-2; ++i) {
            const trigram = entry.label.substr(i, 3);
            let bucket = this.trigramIndex.get(trigram);
            if(!bucket) {
                bucket = new Set();
                this.trigramIndex.set(trigram, bucket);
            }
            bucket.add(entry);
        }
    }

    delete(entry) {
        for(let i = 0; i < entry.label.length-2; ++i) {
            const trigram = entry.label.substr(i, 3),
                  bucket = this.trigramIndex.get(trigram);
            if(!bucket)
                continue;
            bucket.delete(entry);
            if(bucket.size === 0)
                this.trigramIndex.delete(bucket);
        }
    }

    get(key) {
        if(key.length < 3)
            return [];
        const hits = new Map();
        for(let i = 0; i < key.length-2; ++i) {
            const trigram = key.substr(i, 3),
                  bucket = this.trigramIndex.get(trigram);
            if(!bucket)
                continue;
            for(const entry of bucket)
                hits.set(entry, (hits.has(entry) ? hits.get(entry) : 0) + 1);
        }
        const result = [];
        for(const [entry, count] of hits)
            result.push({'entry': entry, 'score': count + ((entry.label === key) ? 1 : 0)});
        result.sort(function(a, b) { return a.score < b.score; });
        return result
    }
}
