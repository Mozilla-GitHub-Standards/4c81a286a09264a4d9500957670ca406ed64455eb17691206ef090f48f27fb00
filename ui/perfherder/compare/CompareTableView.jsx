import React from 'react';
import PropTypes from 'prop-types';
import {
  Col,
  Row,
  Container,
  UncontrolledDropdown,
  DropdownToggle,
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';

import ErrorMessages from '../../shared/ErrorMessages';
import {
  genericErrorMessage,
  errorMessageClass,
  compareDefaultTimeRange,
  phTimeRanges,
} from '../../helpers/constants';
import ErrorBoundary from '../../shared/ErrorBoundary';
import { getData } from '../../helpers/http';
import {
  createApiUrl,
  perfSummaryEndpoint,
  createQueryParams,
} from '../../helpers/url';
import DropdownMenuItems from '../../shared/DropdownMenuItems';

import RevisionInformation from './RevisionInformation';
import CompareTableControls from './CompareTableControls';
import NoiseTable from './NoiseTable';
import ResultsAlert from './ResultsAlert';

// TODO remove $stateParams and $state after switching to react router
export default class CompareTableView extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      compareResults: new Map(),
      testsNoResults: null,
      testsWithNoise: [],
      failureMessage: '',
      loading: false,
      timeRange: this.setTimeRange(),
      framework: this.getFrameworkData(),
      title: '',
    };
  }

  componentDidMount() {
    this.getPerformanceData();
  }

  componentDidUpdate(prevProps) {
    if (this.props !== prevProps) {
      this.getPerformanceData();
    }
  }

  getFrameworkData = () => {
    const { framework, frameworks } = this.props.validated;

    if (framework) {
      const frameworkObject = frameworks.find(
        item => item.id === parseInt(framework, 10),
      );
      // framework is validated in the withValidation component so
      // we know this object will always exist
      return frameworkObject;
    }
    return { id: 1, name: 'talos' };
  };

  setTimeRange = () => {
    const { selectedTimeRange, originalRevision } = this.props.validated;

    if (originalRevision) {
      return null;
    }

    let timeRange;
    if (selectedTimeRange) {
      timeRange = phTimeRanges.find(
        timeRange => timeRange.value === parseInt(selectedTimeRange, 10),
      );
    }

    return timeRange || compareDefaultTimeRange;
  };

  getPerformanceData = async () => {
    const { getQueryParams, hasSubtests, getDisplayResults } = this.props;
    const {
      originalProject,
      originalRevision,
      newProject,
      newRevision,
    } = this.props.validated;
    const { framework, timeRange } = this.state;

    this.setState({ loading: true });

    const [originalParams, newParams] = getQueryParams(timeRange, framework);

    const [originalResults, newResults] = await Promise.all([
      getData(createApiUrl(perfSummaryEndpoint, originalParams)),
      getData(createApiUrl(perfSummaryEndpoint, newParams)),
    ]);

    if (originalResults.failureStatus) {
      return this.setState({
        failureMessage: originalResults.data,
        loading: false,
      });
    }

    if (newResults.failureStatus) {
      return this.setState({
        failureMessage: newResults.data,
        loading: false,
      });
    }

    const data = [...originalResults.data, ...newResults.data];
    let rowNames;
    let tableNames;
    let title;

    if (!data.length) {
      return this.setState({ loading: false });
    }

    if (hasSubtests) {
      let subtestName = data[0].name.split(' ');
      subtestName.splice(1, 1);
      subtestName = subtestName.join(' ');

      title = `${data[0].platform}: ${subtestName}`;
      tableNames = [subtestName];
      rowNames = [...new Set(data.map(item => item.test))].sort();
    } else {
      tableNames = [...new Set(data.map(item => item.name))].sort();
      rowNames = [...new Set(data.map(item => item.platform))].sort();
    }

    const text = originalRevision
      ? `${originalRevision} (${originalProject})`
      : originalProject;

    window.document.title =
      title || `Comparison between ${text} and ${newRevision} (${newProject})`;

    const updates = getDisplayResults(originalResults.data, newResults.data, {
      ...this.state,
      ...{ tableNames, rowNames },
    });
    updates.title = title;
    return this.setState(updates);
  };

  updateFramework = selection => {
    const { frameworks, updateParams } = this.props.validated;
    const framework = frameworks.find(item => item.name === selection);

    updateParams({ framework: framework.id });
    this.setState({ framework }, () => this.getPerformanceData());
  };

  updateTimeRange = selection => {
    const { updateParams } = this.props.validated;
    const timeRange = phTimeRanges.find(item => item.text === selection);

    updateParams({ selectedTimeRange: timeRange.value });
    this.setState({ timeRange }, () => this.getPerformanceData());
  };

  render() {
    const {
      originalProject,
      newProject,
      originalRevision,
      newRevision,
      originalResultSet,
      newResultSet,
      frameworks,
    } = this.props.validated;

    const { filterByFramework, hasSubtests } = this.props;
    const {
      compareResults,
      loading,
      failureMessage,
      testsWithNoise,
      timeRange,
      testsNoResults,
      title,
      framework,
    } = this.state;

    const timeRangeOptions = phTimeRanges.map(option => option.text);
    const frameworkNames =
      frameworks && frameworks.length ? frameworks.map(item => item.name) : [];

    const params = { originalProject, newProject, newRevision };

    if (originalRevision) {
      params.originalRevision = originalRevision;
    } else if (timeRange) {
      params.selectedTimeRange = timeRange.value;
    }

    return (
      <Container fluid className="max-width-default">
        {loading && !failureMessage && (
          <div className="loading">
            <FontAwesomeIcon icon={faCog} size="4x" spin />
          </div>
        )}
        <ErrorBoundary
          errorClasses={errorMessageClass}
          message={genericErrorMessage}
        >
          <React.Fragment>
            {hasSubtests && (
              <p>
                <a href={`perf.html#/compare${createQueryParams(params)}`}>
                  Show all tests and platforms
                </a>
              </p>
            )}

            <div className="mx-auto">
              <Row className="justify-content-center">
                <Col sm="8" className="text-center">
                  {failureMessage && (
                    <ErrorMessages failureMessage={failureMessage} />
                  )}
                </Col>
              </Row>
              {newRevision && newProject && (originalRevision || timeRange) && (
                <Row>
                  <Col sm="12" className="text-center pb-1">
                    <h1>
                      {hasSubtests
                        ? `${title} subtest summary`
                        : 'Perfherder Compare Revisions'}
                    </h1>
                    <RevisionInformation
                      originalProject={originalProject}
                      originalRevision={originalRevision}
                      originalResultSet={originalResultSet}
                      newProject={newProject}
                      newRevision={newRevision}
                      newResultSet={newResultSet}
                      selectedTimeRange={timeRange}
                    />
                  </Col>
                </Row>
              )}

              {testsNoResults && (
                <ResultsAlert testsNoResults={testsNoResults} />
              )}

              <CompareTableControls
                {...this.props}
                frameworkOptions={
                  filterByFramework && (
                    <Col sm="auto" className="py-0 pl-0 pr-3">
                      <UncontrolledDropdown className="mr-0 text-nowrap">
                        <DropdownToggle caret>{framework.name}</DropdownToggle>
                        {frameworkNames && (
                          <DropdownMenuItems
                            options={frameworkNames}
                            selectedItem={framework.name}
                            updateData={this.updateFramework}
                          />
                        )}
                      </UncontrolledDropdown>
                    </Col>
                  )
                }
                updateState={state => this.setState(state)}
                compareResults={compareResults}
                dateRangeOptions={
                  !originalRevision && (
                    <Col sm="auto" className="p-0">
                      <UncontrolledDropdown className="mr-0 text-nowrap">
                        <DropdownToggle caret>{timeRange.text}</DropdownToggle>
                        <DropdownMenuItems
                          options={timeRangeOptions}
                          selectedItem={timeRange.text}
                          updateData={this.updateTimeRange}
                        />
                      </UncontrolledDropdown>
                    </Col>
                  )
                }
                showTestsWithNoise={
                  testsWithNoise.length > 0 && (
                    <Row>
                      <Col sm="12" className="text-center">
                        <NoiseTable
                          testsWithNoise={testsWithNoise}
                          hasSubtests={hasSubtests}
                        />
                      </Col>
                    </Row>
                  )
                }
              />
            </div>
          </React.Fragment>
        </ErrorBoundary>
      </Container>
    );
  }
}

CompareTableView.propTypes = {
  validated: PropTypes.shape({
    originalResultSet: PropTypes.shape({}),
    newResultSet: PropTypes.shape({}),
    newRevision: PropTypes.string,
    originalProject: PropTypes.string,
    newProject: PropTypes.string,
    originalRevision: PropTypes.string,
    projects: PropTypes.arrayOf(PropTypes.shape({})),
    frameworks: PropTypes.arrayOf(PropTypes.shape({})),
    selectedTimeRange: PropTypes.string,
    updateParams: PropTypes.func.isRequired,
    originalSignature: PropTypes.string,
    newSignature: PropTypes.string,
    framework: PropTypes.string,
  }),
  dateRangeOptions: PropTypes.oneOfType([PropTypes.shape({}), PropTypes.bool]),
  filterByFramework: PropTypes.oneOfType([PropTypes.shape({}), PropTypes.bool]),
  getDisplayResults: PropTypes.func.isRequired,
  getQueryParams: PropTypes.func.isRequired,
  hasSubtests: PropTypes.bool,
  $stateParams: PropTypes.shape({}).isRequired,
  $state: PropTypes.shape({}).isRequired,
};

CompareTableView.defaultProps = {
  dateRangeOptions: null,
  filterByFramework: null,
  validated: PropTypes.shape({}),
  hasSubtests: false,
};
