import { AssetBuyer, AssetBuyerError, BuyQuote } from '@0x/asset-buyer';
import { Web3Wrapper } from '@0x/web3-wrapper';
import * as _ from 'lodash';
import * as React from 'react';
import { oc } from 'ts-optchain';

import { WEB_3_WRAPPER_TRANSACTION_FAILED_ERROR_MSG_PREFIX } from '../constants';
import { ColorOption } from '../style/theme';
import { AffiliateInfo, ZeroExInstantError } from '../types';
import { getBestAddress } from '../util/address';
import { balanceUtil } from '../util/balance';
import { gasPriceEstimator } from '../util/gas_price_estimator';
import { util } from '../util/util';

import { Button } from './ui/button';
import { Text } from './ui/text';

export interface BuyButtonProps {
    buyQuote?: BuyQuote;
    assetBuyer: AssetBuyer;
    affiliateInfo?: AffiliateInfo;
    onValidationPending: (buyQuote: BuyQuote) => void;
    onValidationFail: (buyQuote: BuyQuote, errorMessage: AssetBuyerError | ZeroExInstantError) => void;
    onSignatureDenied: (buyQuote: BuyQuote) => void;
    onBuyProcessing: (buyQuote: BuyQuote, txHash: string, startTimeUnix: number, expectedEndTimeUnix: number) => void;
    onBuySuccess: (buyQuote: BuyQuote, txHash: string) => void;
    onBuyFailure: (buyQuote: BuyQuote, txHash: string) => void;
}

export class BuyButton extends React.Component<BuyButtonProps> {
    public static defaultProps = {
        onClick: util.boundNoop,
        onBuySuccess: util.boundNoop,
        onBuyFailure: util.boundNoop,
    };
    public render(): React.ReactNode {
        const shouldDisableButton = _.isUndefined(this.props.buyQuote);
        return (
            <Button width="100%" onClick={this._handleClick} isDisabled={shouldDisableButton}>
                <Text fontColor={ColorOption.white} fontWeight={600} fontSize="20px">
                    Buy
                </Text>
            </Button>
        );
    }
    private readonly _handleClick = async () => {
        // The button is disabled when there is no buy quote anyway.
        const { buyQuote, assetBuyer, affiliateInfo } = this.props;
        if (_.isUndefined(buyQuote)) {
            return;
        }

        this.props.onValidationPending(buyQuote);

        // TODO(bmillman): move address and balance fetching to the async state
        const web3Wrapper = new Web3Wrapper(assetBuyer.provider);
        const takerAddress = await getBestAddress(web3Wrapper);

        const hasSufficientEth = await balanceUtil.hasSufficientEth(takerAddress, buyQuote, web3Wrapper);
        if (!hasSufficientEth) {
            this.props.onValidationFail(buyQuote, ZeroExInstantError.InsufficientETH);
            return;
        }

        let txHash: string | undefined;
        const gasInfo = await gasPriceEstimator.getGasInfoAsync();
        const feeRecipient = oc(affiliateInfo).feeRecipient();
        try {
            txHash = await assetBuyer.executeBuyQuoteAsync(buyQuote, {
                feeRecipient,
                takerAddress,
                gasPrice: gasInfo.gasPriceInWei,
            });
        } catch (e) {
            if (e instanceof Error) {
                if (e.message === AssetBuyerError.SignatureRequestDenied) {
                    this.props.onSignatureDenied(buyQuote);
                    return;
                } else if (e.message === AssetBuyerError.TransactionValueTooLow) {
                    this.props.onValidationFail(buyQuote, AssetBuyerError.TransactionValueTooLow);
                    return;
                }
            }
            throw e;
        }

        const startTimeUnix = new Date().getTime();
        const expectedEndTimeUnix = startTimeUnix + gasInfo.estimatedTimeMs;
        this.props.onBuyProcessing(buyQuote, txHash, startTimeUnix, expectedEndTimeUnix);
        try {
            await web3Wrapper.awaitTransactionSuccessAsync(txHash);
        } catch (e) {
            if (e instanceof Error && e.message.startsWith(WEB_3_WRAPPER_TRANSACTION_FAILED_ERROR_MSG_PREFIX)) {
                this.props.onBuyFailure(buyQuote, txHash);
                return;
            }
            throw e;
        }

        this.props.onBuySuccess(buyQuote, txHash);
    };
}
