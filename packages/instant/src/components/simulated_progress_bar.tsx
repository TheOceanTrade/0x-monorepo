import * as _ from 'lodash';
import * as React from 'react';
import { Dispatch } from 'redux';

import { PROGRESS_STALL_AT_PERCENTAGE, PROGRESS_TICK_INTERVAL_MS } from '../constants';
import { Action, actions } from '../redux/actions';

import { ColorOption } from '../style/theme';

import { Container } from './ui/container';
import { Flex } from './ui/flex';
import { Text } from './ui/text';

const TICKS_PER_SECOND = 1000 / PROGRESS_TICK_INTERVAL_MS;

const curTimeUnix = () => {
    return new Date().getTime();
};

export interface SimulatedProgressBarProps {
    startTimeUnix: number;
    expectedEndTimeUnix: number;
    ended: boolean;
}
enum TickingRunState {
    None,
    Running,
    Finishing,
}
interface TickingNoneStatus {
    runState: TickingRunState.None;
}
interface TickingRunningStatus {
    runState: TickingRunState.Running;
}
interface TickingFinishingStatus {
    runState: TickingRunState.Finishing;
    increasePercentageEveryTick: number;
}
type TickingStatus = TickingNoneStatus | TickingRunningStatus | TickingFinishingStatus;

export interface SimulatedProgressState {
    percentageDone: number;
    intervalId?: number;
    tickingStatus: TickingStatus;
}
export class SimulatedProgressBar extends React.Component<SimulatedProgressBarProps, SimulatedProgressState> {
    public constructor(props: SimulatedProgressBarProps) {
        super(props);

        // TODO: look into using assert library here?
        if (props.expectedEndTimeUnix <= props.startTimeUnix) {
            throw new Error('End time before start time');
        }

        const intervalId = window.setInterval(this._tick.bind(this), PROGRESS_TICK_INTERVAL_MS);
        this.state = {
            percentageDone: 0,
            intervalId,
            tickingStatus: { runState: TickingRunState.Running },
        };
    }

    public componentDidUpdate(prevProps: SimulatedProgressBarProps, prevState: SimulatedProgressState): void {
        const percentLeft = 100 - this.state.percentageDone;
        const increasePercentageEveryTick = percentLeft / TICKS_PER_SECOND;

        if (prevProps.ended === false && this.props.ended === true) {
            this.setState({
                tickingStatus: {
                    runState: TickingRunState.Finishing,
                    increasePercentageEveryTick,
                },
            });
        }
    }

    public componentWillUnmount(): void {
        this._clearTimer();
    }

    public render(): React.ReactNode {
        // TODO: Consider moving to seperate component
        return (
            <Container padding="20px 20px 0px 20px" width="100%">
                <Container width="100%" backgroundColor={ColorOption.lightGrey} borderRadius="6px">
                    <Container
                        width={`${this.state.percentageDone}%`}
                        backgroundColor={ColorOption.primaryColor}
                        borderRadius="6px"
                        height="6px"
                    />
                </Container>
            </Container>
        );
    }

    private _tick(): void {
        const rawPercentageDone =
            this.state.tickingStatus.runState === TickingRunState.Finishing
                ? this._getNewPercentageFinishing(this.state.tickingStatus)
                : this._getNewPercentageNormal();

        const maxPercentage =
            this.state.tickingStatus.runState === TickingRunState.Finishing ? 100 : PROGRESS_STALL_AT_PERCENTAGE;
        const percentageDone = Math.floor(Math.min(rawPercentageDone, maxPercentage));

        this.setState({
            percentageDone,
        });

        if (percentageDone >= 100) {
            this._clearTimer();
        }
    }

    private _clearTimer(): void {
        if (this.state.intervalId) {
            window.clearTimeout(this.state.intervalId);
        }
    }

    // TODO: consider not taking in a parameter here, might be confusing
    private _getNewPercentageFinishing(tickingStatus: TickingFinishingStatus): number {
        return this.state.percentageDone + tickingStatus.increasePercentageEveryTick;
    }

    private _getNewPercentageNormal(): number {
        const elapsedTimeMs = curTimeUnix() - this.props.startTimeUnix;
        const safeElapsedTimeMs = Math.max(elapsedTimeMs, 1);

        const expectedAmountOfTimeMs = this.props.expectedEndTimeUnix - this.props.startTimeUnix;
        const percentageDone = safeElapsedTimeMs / expectedAmountOfTimeMs * 100;
        return percentageDone;
    }
}