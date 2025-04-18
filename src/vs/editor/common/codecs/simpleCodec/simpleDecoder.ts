/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { At } from './tokens/at.js';
import { Hash } from './tokens/hash.js';
import { Dash } from './tokens/dash.js';
import { Colon } from './tokens/colon.js';
import { FormFeed } from './tokens/formFeed.js';
import { Tab } from '../simpleCodec/tokens/tab.js';
import { Word } from '../simpleCodec/tokens/word.js';
import { VerticalTab } from './tokens/verticalTab.js';
import { Space } from '../simpleCodec/tokens/space.js';
import { NewLine } from '../linesCodec/tokens/newLine.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { ExclamationMark } from './tokens/exclamationMark.js';
import { ReadableStream } from '../../../../base/common/stream.js';
import { CarriageReturn } from '../linesCodec/tokens/carriageReturn.js';
import { LinesDecoder, TLineToken } from '../linesCodec/linesDecoder.js';
import { LeftBracket, RightBracket, TBracket } from './tokens/brackets.js';
import { BaseDecoder } from '../../../../base/common/codecs/baseDecoder.js';
import { LeftParenthesis, RightParenthesis, TParenthesis } from './tokens/parentheses.js';
import { LeftAngleBracket, RightAngleBracket, TAngleBracket } from './tokens/angleBrackets.js';

/**
 * A token type that this decoder can handle.
 */
export type TSimpleToken = Word | Space | Tab | VerticalTab | At | NewLine | FormFeed
	| CarriageReturn | TBracket | TAngleBracket | TParenthesis
	| Colon | Hash | Dash | ExclamationMark;

/**
 * List of well-known distinct tokens that this decoder emits (excluding
 * the word stop characters defined below). Everything else is considered
 * an arbitrary "text" sequence and is emitted as a single `Word` token.
 */
const WELL_KNOWN_TOKENS = Object.freeze([
	Space, Tab, VerticalTab, FormFeed,
	LeftBracket, RightBracket, LeftAngleBracket, RightAngleBracket,
	LeftParenthesis, RightParenthesis, Colon, Hash, Dash, ExclamationMark, At,
]);

/**
 * Characters that stop a "word" sequence.
 * Note! the `\r` and `\n` are excluded from the list because this decoder based on `LinesDecoder` which
 * 	     already handles the `carriagereturn`/`newline` cases and emits lines that don't contain them.
 */
const WORD_STOP_CHARACTERS: readonly string[] = Object.freeze([
	Space.symbol, Tab.symbol, VerticalTab.symbol, FormFeed.symbol, At.symbol,
	LeftBracket.symbol, RightBracket.symbol,
	LeftParenthesis.symbol, RightParenthesis.symbol,
	LeftAngleBracket.symbol, RightAngleBracket.symbol,
	Colon.symbol, Hash.symbol, Dash.symbol, ExclamationMark.symbol,
]);

/**
 * A decoder that can decode a stream of `Line`s into a stream
 * of simple token, - `Word`, `Space`, `Tab`, `NewLine`, etc.
 */
export class SimpleDecoder extends BaseDecoder<TSimpleToken, TLineToken> {
	constructor(
		stream: ReadableStream<VSBuffer>,
	) {
		super(new LinesDecoder(stream));
	}

	protected override onStreamData(line: TLineToken): void {
		// re-emit new line tokens immediately
		if (line instanceof CarriageReturn || line instanceof NewLine) {
			this._onData.fire(line);

			return;
		}

		// loop through the text separating it into `Word` and `Space` tokens
		let i = 0;
		while (i < line.text.length) {
			// index is 0-based, but column numbers are 1-based
			const columnNumber = i + 1;

			// check if the current character is a well-known token
			const tokenConstructor = WELL_KNOWN_TOKENS
				.find((wellKnownToken) => {
					return wellKnownToken.symbol === line.text[i];
				});

			// if it is a well-known token, emit it and continue to the next one
			if (tokenConstructor) {
				this._onData.fire(tokenConstructor.newOnLine(line, columnNumber));

				i++;
				continue;
			}

			// otherwise, it is an arbitrary "text" sequence of characters,
			// that needs to be collected into a single `Word` token, hence
			// read all the characters until a stop character is encountered
			let word = '';
			while (i < line.text.length && !(WORD_STOP_CHARACTERS.includes(line.text[i]))) {
				word += line.text[i];
				i++;
			}

			// emit a "text" sequence of characters as a single `Word` token
			this._onData.fire(
				Word.newOnLine(word, line, columnNumber),
			);
		}
	}
}
