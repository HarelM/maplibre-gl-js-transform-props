import loadGlyphRange from '../style/load_glyph_range';

import TinySDF from '@mapbox/tiny-sdf';
import isChar from '../util/is_char_in_unicode_block';
import {asyncAll} from '../util/util';
import {AlphaImage} from '../util/image';

import type {StyleGlyph} from '../style/style_glyph';
import type {RequestManager} from '../util/request_manager';
import type {Callback} from '../types/callback';

type Entry = {
    // null means we've requested the range, but the glyph wasn't included in the result.
    glyphs: {
        [id: number]: StyleGlyph | null;
    };
    requests: {
        [range: number]: Array<Callback<{
            [_: number]: StyleGlyph | null;
        }>>;
    };
    ranges: {
        [range: number]: boolean | null;
    };
    tinySDF?: TinySDF;
};

export default class GlyphManager {
    requestManager: RequestManager;
    localIdeographFontFamily: string;
    entries: {
        [_: string]: Entry;
    };
    url: string;

    // exposed as statics to enable stubbing in unit tests
    static loadGlyphRange = loadGlyphRange;
    static TinySDF = TinySDF;

    constructor(requestManager: RequestManager, localIdeographFontFamily?: string | null) {
        this.requestManager = requestManager;
        this.localIdeographFontFamily = localIdeographFontFamily;
        this.entries = {};
    }

    setURL(url?: string | null) {
        this.url = url;
    }

    getGlyphs(glyphs: {
        [stack: string]: Array<number>;
    }, callback: Callback<{
        [stack: string]: {
            [id: number]: StyleGlyph;
        };
    }>) {
        const all = [];

        for (const stack in glyphs) {
            for (const id of glyphs[stack]) {
                all.push({stack, id});
            }
        }

        asyncAll(all, ({stack, id}, callback: Callback<{
            stack: string;
            id: number;
            glyph: StyleGlyph;
        }>) => {
            let entry = this.entries[stack];
            if (!entry) {
                entry = this.entries[stack] = {
                    glyphs: {},
                    requests: {},
                    ranges: {}
                };
            }

            let glyph = entry.glyphs[id];
            if (glyph !== undefined) {
                callback(null, {stack, id, glyph});
                return;
            }

            // console.log('glyph_manager', glyph);

            if (this._doesCharSupportLocalGlyph(id) || id === 'a') {
                glyph = this._tinySDF(entry, stack, id);
                entry.glyphs[id] = glyph;
                // console.log('tinysdf', id, glyph)
                callback(null, {stack, id, glyph});
                return;
            }

            // console.log('glyph done')

            const range = Math.floor((id as any).charCodeAt(0) / 256);
            if (range * 256 > 65535) {
                callback(new Error('glyphs > 65535 not supported'));
                return;
            }

            if (entry.ranges[range]) {
                console.log('range already loaded', range, 'glyph is', glyph, 'id is', id);
                if (glyph) {
                    callback(null, {stack, id, glyph});
                    return;
                } else {
                    glyph = this._tinySDF(entry, stack, id);
                    entry.glyphs[id] = glyph;
                    // console.log('tinysdf', id, glyph)
                    callback(null, {stack, id, glyph});
                    return;
                }
            }

            if (!this.url) {
                callback(new Error('glyphsUrl is not set'));
                return;
            }

            let requests = entry.requests[range];
            if (!requests) {
                requests = entry.requests[range] = [];
                GlyphManager.loadGlyphRange(stack, range, this.url, this.requestManager,
                    (err, response?: {
                        [_: number]: StyleGlyph | null;
                    } | null) => {
                        if (response) {
                            for (const id in response) {
                                // console.log('hello', id, String.fromCharCode(+id), response[+id]);
                                if (!this._doesCharSupportLocalGlyph(String.fromCharCode(+id) as any)) {
                                    entry.glyphs[String.fromCharCode(+id)] = response[+id];
                                    // entry.glyphs[String.fromCharCode(+id)].metrics.top -= 4;
                                }
                            }
                            entry.ranges[range] = true;
                        }
                        for (const cb of requests) {
                            cb(err, response);
                        }
                        delete entry.requests[range];
                    });
            }

            requests.push((err, result?: {
                [_: number]: StyleGlyph | null;
            } | null) => {
                if (err) {
                    callback(err);
                } else if (result) {
                    // console.log('hi', id, id.charCodeAt(0), result[id.charCodeAt(0)]);
                    let glyph = null;
                    if (result[id.charCodeAt(0)]) {
                        glyph = {...result[id.charCodeAt(0)]};
                        glyph.id = id;
                    } else {
                        console.log('entry is', entry);
                        glyph = this._tinySDF(entry, stack, id);
                        entry.glyphs[id] = glyph;
                        callback(null, {stack, id, glyph});
                        return;
                    }
                    console.log('id is', id, 'glyph is', glyph);
                    callback(null, {stack, id, glyph: glyph || null});
                    return;
                }
            });
        }, (err, glyphs?: Array<{
            stack: string;
            id: number;
            glyph: StyleGlyph;
        }> | null) => {
            if (err) {
                callback(err);
            } else if (glyphs) {
                const result = {};

                for (const {stack, id, glyph} of glyphs) {
                    // Clone the glyph so that our own copy of its ArrayBuffer doesn't get transferred.
                    (result[stack] || (result[stack] = {}))[id] = glyph && {
                        id: glyph.id,
                        bitmap: glyph.bitmap.clone(),
                        metrics: glyph.metrics
                    };
                }

                callback(null, result);
            }
        });
    }

    _doesCharSupportLocalGlyph(id: number): boolean {
        // return !(/^[\x00-\x7F]*$/.test(id as any));
        /* eslint-disable new-cap */
        return !!this.localIdeographFontFamily &&
            (isChar['CJK Unified Ideographs']((id as any).charCodeAt(0)) ||
                isChar['Hangul Syllables']((id as any).charCodeAt(0)) ||
                isChar['Hiragana']((id as any).charCodeAt(0)) ||
                isChar['Katakana']((id as any).charCodeAt(0)));
        /* eslint-enable new-cap */
    }

    _tinySDF(entry: Entry, stack: string, id: number): StyleGlyph {
        const fontFamily = this.localIdeographFontFamily;
        if (!fontFamily) {
            return;
        }

        // if (!this._doesCharSupportLocalGlyph(id)) {
        //     return;
        // }

        let tinySDF = entry.tinySDF;
        if (!tinySDF) {
            let fontWeight = '400';
            if (/bold/i.test(stack)) {
                fontWeight = '900';
            } else if (/medium/i.test(stack)) {
                fontWeight = '500';
            } else if (/light/i.test(stack)) {
                fontWeight = '200';
            }
            tinySDF = entry.tinySDF = new GlyphManager.TinySDF({
                fontSize: 24,
                buffer: 3,
                radius: 8,
                cutoff: 0.25,
                fontFamily,
                fontWeight
            });
        }

        console.log('tinysdf', id, typeof id);
        // OLIVER
        // const char = tinySDF.draw(String.fromCharCode(id));

        // let char;

        // const cachedChar = localStorage.getItem(id as any);

        // if (cachedChar) {
        //     console.log('cached');
        //     char = JSON.parse(cachedChar);
        //     char.data = Object.values(char.data);
        // } else {
        //     console.log('not cached');
        //     char = tinySDF.draw(id as any);
        //     localStorage.setItem(id as any, JSON.stringify(char));
        // }

        const char = tinySDF.draw(id as any);

        // console.log('char', char, JSON.stringify(char));

        /**
         * TinySDF's "top" is the distance from the alphabetic baseline to the top of the glyph.
         * Server-generated fonts specify "top" relative to an origin above the em box (the origin
         * comes from FreeType, but I'm unclear on exactly how it's derived)
         * ref: https://github.com/mapbox/sdf-glyph-foundry
         *
         * Server fonts don't yet include baseline information, so we can't line up exactly with them
         * (and they don't line up with each other)
         * ref: https://github.com/mapbox/node-fontnik/pull/160
         *
         * To approximately align TinySDF glyphs with server-provided glyphs, we use this baseline adjustment
         * factor calibrated to be in between DIN Pro and Arial Unicode (but closer to Arial Unicode)
         */
        const topAdjustment = 25;

        return {
            id,
            bitmap: new AlphaImage({width: char.width || 30, height: char.height || 30}, char.data),
            metrics: {
                width: char.glyphWidth || 24,
                height: char.glyphHeight || 24,
                left: char.glyphLeft || 0,
                top: char.glyphTop - topAdjustment || -8,
                advance: char.glyphAdvance || 24
            }
        };
    }
}
