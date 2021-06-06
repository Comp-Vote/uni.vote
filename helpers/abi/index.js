// Import contract abis
import COMP_ABI from "helpers/abi/comp.abi";
import SIG_RELAYER_ABI from "helpers/abi/SigRelayer.abi";
import GOVERNER_ALPHA_ABI from "helpers/abi/GovernorAlpha.abi";
import MULTICALL_ABI from "helpers/abi/multicall.abi";

// Mainnet contract addresses
const SIG_RELAYER_ADDRESS = "0xf61d8eef3f479dfa24beaa46bf6f235e6e2f7af8";
const COMP_ADDRESS = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
const GOVERNANCE_ADDRESS = "0x5e4be8Bc9637f0EAA1A755019e06A68ce081D58F";
const MULTICALL_ADDRESS = "0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE441";

// Export as individual exports
export {
  COMP_ABI,
  SIG_RELAYER_ABI,
  GOVERNER_ALPHA_ABI,
  SIG_RELAYER_ADDRESS,
  COMP_ADDRESS,
  GOVERNANCE_ADDRESS,
  MULTICALL_ABI,
  MULTICALL_ADDRESS,
};
