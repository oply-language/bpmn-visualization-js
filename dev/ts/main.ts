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

import type {
  BpmnElement,
  BpmnElementKind,
  FitOptions,
  FitType,
  GlobalOptions,
  LoadOptions,
  ModelFilter,
  Overlay,
  PoolFilter,
  StyleUpdate,
  Version,
  ZoomType,
} from '../../src/bpmn-visualization';
import { FlowKind, ShapeBpmnElementKind } from '../../src/bpmn-visualization';
import { fetchBpmnContent, logDownload, logError, logErrorAndOpenAlert, logStartup, stringify } from './utils/internal-helpers';
import { log } from './utils/shared-helpers';
import { DropFileUserInterface } from './component/DropFileUserInterface';
import { SvgExporter } from './component/SvgExporter';
import { downloadAsPng, downloadAsSvg } from './component/download';
import { ThemedBpmnVisualization } from './component/ThemedBpmnVisualization';

let bpmnVisualization: ThemedBpmnVisualization;
let loadOptions: LoadOptions = {};
let statusKoNotifier: (errorMsg: string) => void;
let bpmnElementIdToCollapse: string;
let currentTheme: string;
let style: StyleUpdate;

export function updateLoadOptions(fitOptions: FitOptions): void {
  log('Updating load options', fitOptions);
  loadOptions.fit = fitOptions;
  log('Load options updated!', stringify(loadOptions));
}

export function getCurrentLoadOptions(): LoadOptions {
  return { ...loadOptions };
}

export function getCurrentTheme(): string | undefined {
  return currentTheme;
}

export function switchTheme(theme: string): void {
  log('Switching theme from %s to %s', currentTheme, theme);
  const knownTheme = bpmnVisualization.configureTheme(theme);
  if (knownTheme) {
    bpmnVisualization.graph.refresh();
    log('Theme switch done');
  }
}

function loadBpmn(bpmn: string, handleError = true): void {
  log('Loading bpmn...');
  try {
    bpmnVisualization.load(bpmn, loadOptions);
    log('BPMN loaded with configuration', stringify(loadOptions));
    collapseBpmnElement(bpmnElementIdToCollapse);
    document.dispatchEvent(new CustomEvent('diagramLoaded'));
  } catch (error) {
    if (handleError) {
      statusKoNotifier(`Cannot load the BPMN diagram: ${error.message}`);
    } else {
      throw error;
    }
  }
}

export function fit(fitOptions: FitOptions): void {
  log('Fitting...');
  bpmnVisualization.navigation.fit(fitOptions);
  log('Fit done with configuration', stringify(fitOptions));
}

export function zoom(zoomType: ZoomType): void {
  log(`Zooming '${zoomType}'...`);
  bpmnVisualization.navigation.zoom(zoomType);
  log('Zoom done');
}

export function getElementsByKinds(bpmnKinds: BpmnElementKind | BpmnElementKind[]): BpmnElement[] {
  return bpmnVisualization.bpmnElementsRegistry.getElementsByKinds(bpmnKinds);
}

export function getElementsByIds(bpmnId: string | string[]): BpmnElement[] {
  return bpmnVisualization.bpmnElementsRegistry.getElementsByIds(bpmnId);
}

export function addCssClasses(bpmnElementId: string | string[], classNames: string | string[]): void {
  return bpmnVisualization.bpmnElementsRegistry.addCssClasses(bpmnElementId, classNames);
}

export function removeCssClasses(bpmnElementId: string | string[], classNames: string | string[]): void {
  return bpmnVisualization.bpmnElementsRegistry.removeCssClasses(bpmnElementId, classNames);
}

export function addOverlays(bpmnElementId: string, overlay: Overlay): void {
  return bpmnVisualization.bpmnElementsRegistry.addOverlays(bpmnElementId, [overlay]);
}

export function removeAllOverlays(bpmnElementId: string): void {
  return bpmnVisualization.bpmnElementsRegistry.removeAllOverlays(bpmnElementId);
}

// Not natively supported by bpmn-visualization for now but demonstrated in https://cdn.statically.io/gh/process-analytics/bpmn-visualization-examples/v0.22.0/examples/custom-behavior/select-elements-by-bpmn-kind/index.html
// We want to ensure that the edges terminal waypoints are correctly set to the enclosing parent (pool or subprocess), whatever the terminal waypoint computation is.
function collapseBpmnElement(bpmnElementId: string): void {
  if (!bpmnElementIdToCollapse) {
    return;
  }
  log('Updating model, bpmnElement to collapse:', bpmnElementId);
  const model = bpmnVisualization.graph.getModel();
  const cell = model.getCell(bpmnElementId);
  if (!cell) {
    log('Element not found in the model, do nothing');
  } else {
    model.beginUpdate();
    try {
      model.setCollapsed(cell, true);
    } finally {
      model.endUpdate();
    }
    log('Model updated');
  }
}

// callback function for opening | dropping the file to be loaded
function readAndLoadFile(f: File): void {
  const reader = new FileReader();
  reader.onload = () => {
    loadBpmn(reader.result as string);
  };
  reader.readAsText(f);
}

// TODO: make File Open Button a self contained component
/**
 * <b>IMPORTANT</b>: be sure to have call the `startBpmnVisualization` function prior calling this function as it relies on resources that must be initialized first.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types
export function handleFileSelect(evt: any): void {
  const f = evt.target.files[0];
  readAndLoadFile(f);
}

function loadBpmnFromUrl(url: string): void {
  fetchBpmnContent(url)
    .catch(error => {
      throw new Error(`Unable to fetch ${url}. ${error}`);
    })
    .then(responseBody => {
      log('BPMN content fetched');
      return responseBody;
    })
    .then(bpmn => {
      loadBpmn(bpmn, false);
      log(`BPMN content loaded from url ${url}`);
    })
    .then(() => {
      updateStyleOfElementsIfRequested();
    })
    .catch((error: Error) => {
      statusKoNotifier(error.message);
    });
}

export interface BpmnVisualizationDemoConfiguration {
  statusKoNotifier?: (errorMsg: string) => void;
  globalOptions: GlobalOptions;
  loadOptions?: LoadOptions;
}

export function windowAlertStatusKoNotifier(errorMsg: string): void {
  logErrorAndOpenAlert(errorMsg);
}

function logOnlyStatusKoNotifier(errorMsg: string): void {
  logError(errorMsg);
}

function getFitOptionsFromParameters(config: BpmnVisualizationDemoConfiguration, parameters: URLSearchParams): FitOptions {
  const fitOptions: FitOptions = config.loadOptions?.fit || {};
  const parameterFitType: string = parameters.get('fitTypeOnLoad');
  if (parameterFitType) {
    // As the parameter is a string, and the load/fit APIs accept only enum to avoid error, we need to convert it
    fitOptions.type = <FitType>parameterFitType;
  }
  const parameterFitMargin = parameters.get('fitMargin');
  if (parameterFitMargin) {
    fitOptions.margin = Number(parameterFitMargin);
  }
  return fitOptions;
}

function configureStyleFromParameters(parameters: URLSearchParams): void {
  const useBpmnContainerAlternativeColor = parameters.get('style.container.alternative.background.color');
  if (useBpmnContainerAlternativeColor == 'true') {
    const color = 'yellow';
    logStartup('Use alternative color for the bpmn container background, color', color);

    const bpmnContainer = bpmnVisualization.graph.container;
    bpmnContainer.style.backgroundColor = color;

    logStartup('Bpmn container style updated');
  }

  const theme = parameters.get('style.theme');
  logStartup(`Configuring the '${theme}' BPMN theme`);
  const updatedTheme = bpmnVisualization.configureTheme(theme);
  if (!updatedTheme) {
    logStartup(`Unknown '${theme}' BPMN theme, skipping configuration`);
  } else {
    currentTheme = theme;
    logStartup(`'${theme}' BPMN theme configured`);
  }

  const useSequenceFlowColorsLight = parameters.get('style.seqFlow.light.colors');
  if (useSequenceFlowColorsLight == 'true') {
    bpmnVisualization.configureSequenceFlowColor('#E9E9E9');
  }

  // Collect style properties to update them later with the bpmn-visualization API
  // The implementation will be generalized when more properties will be supported (in particular, the query parameter name)
  // For example, we could extract all query params starting with style.api, then rebuild the StyleUpdate from the extracted params
  style = {
    stroke: { color: parameters.get('style.api.stroke.color') },
    fill: { color: parameters.get('style.api.fill.color') },
  };
}

function configureBpmnElementIdToCollapseFromParameters(parameters: URLSearchParams): void {
  bpmnElementIdToCollapse = parameters.get('bpmn.element.id.collapsed');
}

function configurePoolsFilteringFromParameters(parameters: URLSearchParams): ModelFilter | undefined {
  const poolIdsToFilterParameter = parameters.get('bpmn.filter.pool.ids');
  if (!poolIdsToFilterParameter) {
    return;
  }
  const poolIdsToFilter = poolIdsToFilterParameter.split(',');
  log('Configuring load options to only include pool id: ', poolIdsToFilter);
  return { pools: poolIdsToFilter.map<PoolFilter>(id => ({ id })) };
}

export function startBpmnVisualization(config: BpmnVisualizationDemoConfiguration): void {
  const log = logStartup;
  log(`Initializing BpmnVisualization with container '${config.globalOptions.container}'...`);
  bpmnVisualization = new ThemedBpmnVisualization(config.globalOptions);
  log('Initialization completed');
  new DropFileUserInterface(window, 'drop-container', bpmnVisualization.graph.container, readAndLoadFile);
  log('Drag&Drop support initialized');

  statusKoNotifier = config.statusKoNotifier ?? logOnlyStatusKoNotifier;

  const parameters = new URLSearchParams(window.location.search);

  log('Configuring Load Options');
  loadOptions = config.loadOptions || {};
  loadOptions.fit = getFitOptionsFromParameters(config, parameters);
  loadOptions.modelFilter = configurePoolsFilteringFromParameters(parameters);

  configureStyleFromParameters(parameters);
  configureBpmnElementIdToCollapseFromParameters(parameters);

  log("Checking if an 'url to fetch BPMN content' is provided as query parameter");
  const urlParameterValue = parameters.get('url');
  if (urlParameterValue) {
    const url = decodeURIComponent(urlParameterValue);
    loadBpmnFromUrl(url);
    return;
  }
  log("No 'url to fetch BPMN content' provided");
}

export function downloadSvg(): void {
  logDownload('Trigger SVG Download');
  downloadAsSvg(new SvgExporter(bpmnVisualization.graph).exportSvg());
}

export function downloadPng(): void {
  logDownload('Trigger PNG Download');
  downloadAsPng(new SvgExporter(bpmnVisualization.graph).exportSvgForPng());
}

export function getVersion(): Version {
  const version = bpmnVisualization.getVersion();
  log('Version:', version);
  return version;
}

function updateStyleOfElementsIfRequested(): void {
  if (style) {
    log("Applying style using the style API: '%s'", style);
    const bpmnElementIds = retrieveAllBpmnElementIds();
    log('Number of elements whose style is to be updated', bpmnElementIds.length);

    bpmnVisualization.bpmnElementsRegistry.updateStyle(bpmnElementIds, style);
    log('New style applied');
  }
}

// May have bad performance for large diagrams as it does CSS selector
function retrieveAllBpmnElementIds(): string[] {
  log('Retrieving ids of all BPMN elements');
  const allKinds = [...Object.values(ShapeBpmnElementKind), ...Object.values(FlowKind)];
  const elements = bpmnVisualization.bpmnElementsRegistry.getElementsByKinds(allKinds);
  const bpmnElementsIds = elements.map(elt => elt.bpmnSemantic.id);
  log('All BPMN elements ids retrieved:', bpmnElementsIds.length);
  return bpmnElementsIds;
}
