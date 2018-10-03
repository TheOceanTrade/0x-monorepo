#!/usr/bin/env node
import { devConstants, web3Factory } from '@0xproject/dev-utils';
import { logUtils } from '@0xproject/utils';
import { Provider } from 'ethereum-types';
import { Web3Wrapper } from '@0xproject/web3-wrapper';
import * as yargs from 'yargs';

import { runV1MigrationsAsync } from './1.0.0/migration';
import { runV2MigrationsAsync } from './2.0.0/migration';

enum ContractVersions {
    V1 = '1.0.0',
    V2 = '2.0.0',
}
const args = yargs.argv;

(async () => {
    const contractsVersion = args.contractsVersion;
    const artifactsDir = `artifacts/${contractsVersion}`;
    let providerConfigs;
    let provider: Provider;
    let txDefaults;
    switch (contractsVersion) {
        case ContractVersions.V1:
            providerConfigs = {
              shouldUseInProcessGanache: false,
              rpcUrl: "localchain:8545",
            };
            provider = web3Factory.getRpcProvider(providerConfigs);
            const web3Wrapper = new Web3Wrapper(provider);
            logUtils.log("web3Wrapper")
            logUtils.log(web3Wrapper)
            const networkId = await web3Wrapper.getNetworkIdAsync();
            logUtils.log("networkId")
            logUtils.log(networkId)
            txDefaults = {
                from: devConstants.TESTRPC_FIRST_ADDRESS,
            };
            await runV1MigrationsAsync(provider, artifactsDir, txDefaults);
            break;
        case ContractVersions.V2:
            providerConfigs = { shouldUseInProcessGanache: false };
            provider = web3Factory.getRpcProvider(providerConfigs);
            txDefaults = {
                from: devConstants.TESTRPC_FIRST_ADDRESS,
            };
            await runV2MigrationsAsync(provider, artifactsDir, txDefaults);
            break;
        default:
            throw new Error(`Unsupported contract version: ${contractsVersion}`);
    }
    process.exit(0);
})().catch(err => {
    logUtils.log(err);
    process.exit(1);
});
