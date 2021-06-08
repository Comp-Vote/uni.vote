import Web3 from "web3"; // Web3
import axios from "axios"; // Axios requests
import {
  GOVERNER_ALPHA_ABI,
  GOVERNANCE_ADDRESS,
  MULTICALL_ABI,
  MULTICALL_ADDRESS,
} from "helpers/abi"; // Contract ABIs + Addresses

/// Global defining key values for proposal states
const statesKey = [
  "Pending",
  "Active",
  "Canceled",
  "Defeated",
  "Succeeded",
  "Queued",
  "Expired",
  "Executed",
];

/**
 * Instantiates server-side web3 connection
 */
const Web3Handler = () => {
  // Setup web3 handler
  const web3 = new Web3(process.env.NEXT_PUBLIC_INFURA_RPC);

  // Setup contracts
  const multicall = new web3.eth.Contract(MULTICALL_ABI, MULTICALL_ADDRESS);
  const governanceAlpha = new web3.eth.Contract(
    GOVERNER_ALPHA_ABI,
    GOVERNANCE_ADDRESS
  );

  // Return web3 + contracts
  return {
    web3,
    governanceAlpha,
    multicall,
  };
};

export default async (req, res) => {
  let { page_number = 1, page_size = 10 } = req.query;
  page_size = Number(page_size);
  page_number = Number(page_number);
  const { web3, governanceAlpha, multicall } = Web3Handler();
  let proposalCount = Number(
    await governanceAlpha.methods.proposalCount().call()
  );
  const offset = (page_number - 1) * page_size;

  let graphRes, states;
  let resData = {};

  let pagationSummary = {};

  pagationSummary.page_number = Number(page_number);
  pagationSummary.total_pages = Math.ceil(proposalCount / page_size);

  if (page_number < 1 || page_number > pagationSummary.total_pages) {
    res.status(400).send("Invalid page number");
    return;
  }

  pagationSummary.page_size = page_size;
  pagationSummary.total_entries = proposalCount;
  resData.pagation_summary = pagationSummary;
  
  [graphRes, states] = await Promise.all([
    axios.post(
      "https://api.thegraph.com/subgraphs/name/ianlapham/governance-tracking",
      {
        query:
          `{
          proposals(first:` +
          page_size +
          ` skip:` +
          offset +
          ` orderBy:startBlock) {
            id
            description
          }
        }`,
      }
    ),
    multicall.methods
      .aggregate(
        genCalls(
          "0x5e4be8Bc9637f0EAA1A755019e06A68ce081D58F",
          "0x3e4f49e6",
          offset + 1,
          offset + page_size > proposalCount
            ? proposalCount
            : offset + page_size,
          web3
        )
      )
      .call(),
  ]);
  let stringStates = [];
  for (const state of states["returnData"]) {
    stringStates.push(statesKey[Number(state[state.length - 1])]);
  }
  let proposalData = [];
  for (const proposal of graphRes.data.data.proposals) {
    let newProposal = {};
    newProposal.title = proposal.description.split("\n")[0].substring(2);
    newProposal.id = proposal.id;
    newProposal.state = stringStates.shift();
    proposalData.push(newProposal);
  }
  resData.proposals = proposalData;
  res.json(resData);
};

/**
 * Generate hex calls for a call signature and a range of uint256 parameter input
 * @param {String} target Contract to call
 * @param {String} callPrefix Function hex sig
 * @param {Number} first First input
 * @param {Number} last Last input
 * @param {Web3} web3 Web3 instance, used for encoding parameters
 * @returns [] Call input for multicall
 */
function genCalls(target, callPrefix, first, last, web3) {
  let res = [];
  for (let i = first; i <= last; i++) {
    res.push({
      target: target,
      callData:
        callPrefix + web3.eth.abi.encodeParameter("uint256", i).substring(2),
    });
  }
  console.log(res);
  return res;
}
