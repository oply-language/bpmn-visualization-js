/*
Copyright 2020 Bonitasoft S.A.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { XMLParser, type X2jOptions } from 'fast-xml-parser';
import type { BpmnJsonModel } from '../../../model/bpmn/json/bpmn20';
import type { ParserOptions } from '../../options';

type Replacement = {
  regex: RegExp;
  val: string;
};
const entitiesReplacements: Replacement[] = [
  { regex: /&(amp|#38|#x26);/g, val: '&' },
  { regex: /&(apos|#39|#x27);/g, val: "'" },
  { regex: /&#(xa|xA|10);/g, val: '\n' },
  { regex: /&(gt|#62|#x3e|#x3E);/g, val: '>' },
  { regex: /&(lt|#60|#x3c|#x3C);/g, val: '<' },
  { regex: /&(quot|#34|#x22);/g, val: '"' },
];

/**
 * @internal
 */
export type XmlParserOptions = Pick<ParserOptions, 'additionalXmlAttributeProcessor'>;

/**
 * Parse bpmn xml source
 * @internal
 */
export default class BpmnXmlParser {
  private readonly x2jOptions: Partial<X2jOptions> = {
    attributeNamePrefix: '', // default to '@_'
    removeNSPrefix: true,
    ignoreAttributes: false,
    parseAttributeValue: true, // ensure numbers are parsed as number, not as string
    // entities management
    processEntities: false, // If you don't have entities in your XML document then it is recommended to disable it for better performance.
    attributeValueProcessor: (_name: string, val: string) => {
      return this.processAttribute(val);
    },
  };
  private xmlParser: XMLParser = new XMLParser(this.x2jOptions);

  constructor(private options?: XmlParserOptions) {}

  parse(xml: string): BpmnJsonModel {
    let model: BpmnJsonModel;
    try {
      model = this.xmlParser.parse(xml);
    } catch {
      throw new Error('XML parsing failed. Invalid BPMN source.');
    }
    if (!model.definitions) {
      // We currently don't validate the xml, so we don't detect xml validation error
      // if 'definitions' is undefined, there is an Error later in the parsing code without explicit information
      // So for now, throw a generic error that better explains the problem.
      // See https://github.com/process-analytics/bpmn-visualization-js/issues/21 for improvement
      throw new Error(`XML parsing failed. Unable to retrieve 'definitions' from the BPMN source.`);
    }
    return model;
  }

  private processAttribute(val: string): string {
    for (const replacement of entitiesReplacements) {
      val = val.replace(replacement.regex, replacement.val);
    }
    if (this.options?.additionalXmlAttributeProcessor) {
      val = this.options.additionalXmlAttributeProcessor(val);
    }
    return val;
  }
}
