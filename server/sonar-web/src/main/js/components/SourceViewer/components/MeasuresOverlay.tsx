/*
 * SonarQube
 * Copyright (C) 2009-2018 SonarSource SA
 * mailto:info AT sonarsource DOT com
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */
import * as React from 'react';
import { Link } from 'react-router';
import { keyBy, sortBy } from 'lodash';
import Modal from '../../controls/Modal';
import Measure from '../../measure/Measure';
import QualifierIcon from '../../shared/QualifierIcon';
import { getProjectUrl } from '../../../helpers/urls';
import { translate, getLocalizedMetricName } from '../../../helpers/l10n';
import { getAllMetrics } from '../../../api/metrics';
import { getMeasures } from '../../../api/measures';
import { Metric } from '../../../app/types';
import IssueTypeIcon from '../../ui/IssueTypeIcon';
import { formatMeasure } from '../../../helpers/measures';
import SeverityHelper from '../../shared/SeverityHelper';
import { getFacets } from '../../../api/issues';
import { SEVERITIES, TYPES } from '../../../helpers/constants';
import CoverageRating from '../../ui/CoverageRating';
import DuplicationsRating from '../../ui/DuplicationsRating';

interface Props {
  branch: string | undefined;
  component: {
    key: string;
    longName?: string;
    path: string;
    project: string;
    projectName: string;
    q: string;
    subProject?: string;
    subProjectName?: string;
  };
  onClose: () => void;
}

interface MeasureWithMetric {
  metric: Metric;
  value?: string;
}

interface Measures {
  [metricKey: string]: MeasureWithMetric | undefined;
}

interface Facet {
  count: number;
  val: string;
}

interface State {
  loading: boolean;
  measures: Measures;
  severitiesFacet?: Facet[];
  tagsFacet?: Facet[];
  typesFacet?: Facet[];
}

export default class MeasuresOverlay extends React.PureComponent<Props, State> {
  mounted = false;
  state: State = { loading: true, measures: {} };

  componentDidMount() {
    this.mounted = true;
    this.fetchData();
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  fetchData = () => {
    Promise.all([this.fetchMeasures(), this.fetchIssues()]).then(
      ([measures, facets]) => {
        if (this.mounted) {
          this.setState({ loading: false, measures, ...facets });
        }
      },
      () => {
        if (this.mounted) {
          this.setState({ loading: false });
        }
      }
    );
  };

  fetchMeasures = () => {
    return getAllMetrics().then(metrics => {
      const metricKeys = metrics
        .filter(metric => metric.type !== 'DATA' && !metric.hidden)
        .map(metric => metric.key);

      // eslint-disable-next-line promise/no-nesting
      return getMeasures(this.props.component.key, metricKeys, this.props.branch).then(measures => {
        const withMetrics = measures
          .map(measure => {
            const metric = metrics.find(metric => metric.key === measure.metric);
            return { ...measure, metric };
          })
          .filter(measure => measure.metric) as MeasureWithMetric[];
        return keyBy(withMetrics, measure => measure.metric.key);
      });
    });
  };

  fetchIssues = () => {
    return getFacets(
      {
        branch: this.props.branch,
        componentKeys: this.props.component.key,
        resolved: 'false'
      },
      ['types', 'severities', 'tags']
    ).then(({ facets }) => {
      const severitiesFacet = facets.find(f => f.property === 'severities');
      const tagsFacet = facets.find(f => f.property === 'tags');
      const typesFacet = facets.find(f => f.property === 'types');
      return {
        severitiesFacet: severitiesFacet && severitiesFacet.values,
        tagsFacet: tagsFacet && tagsFacet.values,
        typesFacet: typesFacet && typesFacet.values
      };
    });
  };

  handleCloseClick = (event: React.SyntheticEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.blur();
    this.props.onClose();
  };

  handleAllMeasuresClick = (event: React.SyntheticEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    event.currentTarget.blur();
    // TODO
  };

  renderMeasure = (measure: MeasureWithMetric | undefined) => {
    return measure ? (
      <div className="measure measure-one-line" data-metric={measure.metric.key}>
        <span className="measure-name">{getLocalizedMetricName(measure.metric)}</span>
        <span className="measure-value">
          <Measure
            metricKey={measure.metric.key}
            metricType={measure.metric.type}
            value={measure.value}
          />
        </span>
      </div>
    ) : null;
  };

  renderComments = () => {
    const { comment_lines: lines, comment_lines_density: density } = this.state.measures;
    if (!lines || !density) {
      return null;
    }
    return (
      <div className="measure measure-one-line" data-metric="comment_lines">
        <span className="measure-name">{getLocalizedMetricName(density.metric, true)}</span>
        <span className="measure-value">
          <Measure
            metricKey={density.metric.key}
            metricType={density.metric.type}
            value={density.value}
          />
          {' / '}
          <Measure
            metricKey={lines.metric.key}
            metricType={lines.metric.type}
            value={lines.value}
          />
        </span>
      </div>
    );
  };

  renderLines = () => {
    const { measures } = this.state;

    return (
      <div className="source-viewer-measures-section">
        <div className="source-viewer-measures-card">
          <div className="measures">
            <div className="measures-list">
              {this.renderMeasure(measures.lines)}
              {this.renderMeasure(measures.ncloc)}
              {this.renderComments()}
            </div>
          </div>

          <div className="measures">
            <div className="measures-list">
              {this.renderMeasure(measures.complexity)}
              {this.renderMeasure(measures.function_complexity)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  renderBigMeasure = (measure: MeasureWithMetric | undefined) => {
    return measure ? (
      <div className="measure measure-big" data-metric={measure.metric.key}>
        <span className="measure-value">
          <Measure
            metricKey={measure.metric.key}
            metricType={measure.metric.type}
            value={measure.value}
          />
        </span>
        <span className="measure-name">{getLocalizedMetricName(measure.metric, true)}</span>
      </div>
    ) : null;
  };

  renderIssues = () => {
    const { measures, severitiesFacet, tagsFacet, typesFacet } = this.state;
    return (
      <div className="source-viewer-measures-section">
        <div className="source-viewer-measures-card">
          <div className="measures">
            {this.renderBigMeasure(measures.violations)}
            {this.renderBigMeasure(measures.sqale_index)}
          </div>
          {typesFacet && (
            <div className="measures">
              <div className="measures-list">
                {sortBy(typesFacet, f => TYPES.indexOf(f.val)).map(f => (
                  <div className="measure measure-one-line" key={f.val}>
                    <span className="measure-name">
                      <IssueTypeIcon className="little-spacer-right" query={f.val} />
                      {translate('issue.type', f.val)}
                    </span>
                    <span className="measure-value">{formatMeasure(f.count, 'SHORT_INT')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {severitiesFacet && (
            <div className="measures">
              <div className="measures-list">
                {sortBy(severitiesFacet, f => SEVERITIES.indexOf(f.val)).map(f => (
                  <div className="measure measure-one-line" key={f.val}>
                    <span className="measure-name">
                      <SeverityHelper severity={f.val} />
                    </span>
                    <span className="measure-value">{formatMeasure(f.count, 'SHORT_INT')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tagsFacet && (
            <div className="measures">
              <div className="measures-list">
                {tagsFacet.map(f => (
                  <div className="measure measure-one-line" key={f.val}>
                    <span className="measure-name">
                      <i className="icon-tags little-spacer-right" />
                      {f.val}
                    </span>
                    <span className="measure-value">{formatMeasure(f.count, 'SHORT_INT')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  renderCoverage = () => {
    const { coverage } = this.state.measures;
    if (!coverage) {
      return null;
    }
    return (
      <div className="source-viewer-measures-section">
        <div className="source-viewer-measures-card">
          <div className="measures">
            <div className="measures-chart">
              <CoverageRating size="big" value={coverage.value} />
            </div>
            <div className="measure measure-big" data-metric={coverage.metric.key}>
              <span className="measure-value">
                <Measure
                  metricKey={coverage.metric.key}
                  metricType={coverage.metric.type}
                  value={coverage.value}
                />
              </span>
              <span className="measure-name">{getLocalizedMetricName(coverage.metric)}</span>
            </div>
          </div>

          <div className="measures">
            <div className="measures-list">
              {this.renderMeasure(this.state.measures.uncovered_lines)}
              {this.renderMeasure(this.state.measures.lines_to_cover)}
              {this.renderMeasure(this.state.measures.uncovered_conditions)}
              {this.renderMeasure(this.state.measures.conditions_to_cover)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  renderDuplications = () => {
    const { duplicated_lines_density: duplications } = this.state.measures;
    if (!duplications) {
      return null;
    }
    return (
      <div className="source-viewer-measures-section">
        <div className="source-viewer-measures-card">
          <div className="measures">
            <div className="measures-chart">
              <DuplicationsRating
                muted={duplications.value === undefined}
                size="big"
                value={Number(duplications.value || 0)}
              />
            </div>
            <div className="measure measure-big" data-metric={duplications.metric.key}>
              <span className="measure-value">
                <Measure
                  metricKey={duplications.metric.key}
                  metricType={duplications.metric.type}
                  value={duplications.value}
                />
              </span>
              <span className="measure-name">
                {getLocalizedMetricName(duplications.metric, true)}
              </span>
            </div>
          </div>

          <div className="measures">
            <div className="measures-list">
              {this.renderMeasure(this.state.measures.duplicated_blocks)}
              {this.renderMeasure(this.state.measures.duplicated_lines)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  render() {
    const contendLabel = ''; // TODO
    const { branch, component } = this.props;
    const { loading } = this.state;

    return (
      <Modal contentLabel={contendLabel} large={true} onRequestClose={this.props.onClose}>
        <div className="modal-container source-viewer-measures-modal">
          <div className="source-viewer-header-component source-viewer-measures-component">
            <div className="source-viewer-header-component-project">
              <QualifierIcon className="little-spacer-right" qualifier="TRK" />
              <Link to={getProjectUrl(component.project, branch)}>{component.projectName}</Link>

              {component.subProject && (
                <>
                  <QualifierIcon className="big-spacer-left little-spacer-right" qualifier="BRC" />
                  <Link to={getProjectUrl(component.subProject, branch)}>
                    {component.subProjectName}
                  </Link>
                </>
              )}
            </div>

            <div className="source-viewer-header-component-name">
              <QualifierIcon className="little-spacer-right" qualifier={component.q} />
              {component.path || component.longName}
            </div>
          </div>

          {loading ? (
            <i className="spinner" />
          ) : (
            <>
              {component.q === 'UTS' ? (
                <>
                  <div className="source-viewer-measures">
                    <div className="source-viewer-measures-section">{/* TODO tests */}</div>
                  </div>
                  <div className="source-viewer-measures">{/* TODO test cases */}</div>
                </>
              ) : (
                <div className="source-viewer-measures">
                  {this.renderLines()}
                  {this.renderIssues()}
                  {this.renderCoverage()}
                  {this.renderDuplications()}
                </div>
              )}
            </>
          )}

          <div className="spacer-top">
            <a className="js-show-all-measures" href="#" onClick={this.handleAllMeasuresClick}>
              {translate('component_viewer.show_all_measures')}
            </a>
          </div>

          <div className="source-viewer-measures source-viewer-measures-secondary js-all-measures hidden">
            {/* TODO all measures */}
          </div>
        </div>

        <footer className="modal-foot">
          <button className="button-link" onClick={this.handleCloseClick} type="button">
            {translate('close')}
          </button>
        </footer>
      </Modal>
    );
  }
}
