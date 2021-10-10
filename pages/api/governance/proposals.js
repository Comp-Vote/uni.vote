import Web3 from "web3"; // Web3
import axios from "axios"; // Axios requests
import {
  GOVERNER_ALPHA_ABI,
  GOVERNER_BRAVO_ABI,
  GOVERNANCE_ADDRESS_BRAVO,
  GOVERNANCE_ADDRESS_ALPHA1,
  GOVERNANCE_ADDRESS_ALPHA2,
  MULTICALL_ABI,
  MULTICALL_ADDRESS,
} from "helpers/abi"; // Contract ABIs + Addresses

/// Global defining key values for proposal states
const statesKey = [
  "Pending", // creation block
  "Active", // start block
  "Canceled", // cancelation block
  "Defeated", // end block
  "Succeeded", // end block
  "Queued", // executionETA - 2 days
  "Expired",
  "Executed", // execution block
];

/**
 * Instantiates server-side web3 connection
 */
const Web3Handler = () => {
  // Setup web3 handler
  const web3 = new Web3(process.env.NEXT_PUBLIC_INFURA_RPC);

  // Setup contracts
  const multicall = new web3.eth.Contract(MULTICALL_ABI, MULTICALL_ADDRESS);

  const governanceBravo = new web3.eth.Contract(
    GOVERNER_BRAVO_ABI,
    GOVERNANCE_ADDRESS_BRAVO
  );

  const governanceAlpha1 = new web3.eth.Contract(
    GOVERNER_ALPHA_ABI,
    GOVERNANCE_ADDRESS_ALPHA1
  );

  const governanceAlpha2 = new web3.eth.Contract(
    GOVERNER_ALPHA_ABI,
    GOVERNANCE_ADDRESS_ALPHA2
  );

  // Return web3 + contracts
  return {
    web3,
    governanceAlpha1,
    governanceAlpha2,
    governanceBravo,
    multicall,
  };
};

export default async (req, res) => {
  let { page_number = 1, page_size = 10, get_state_times = false } = req.query;
  page_size = Number(page_size);
  page_number = Number(page_number);
  const {
    web3,
    governanceAlpha1,
    governanceAlpha2,
    governanceBravo,
    multicall,
  } = Web3Handler();
  const proposalCount = Number(
    await governanceBravo.methods.proposalCount().call()
  );

  const proposalCountDeprecated1 = 5;
  const proposalCountDeprecated2 = 3;

  const offset = (page_number - 1) * page_size;

  let graphRes, states;
  let resData = {};

  let pagination_summary = {};

  pagination_summary.page_number = Number(page_number);
  pagination_summary.total_pages = Math.ceil(
    (proposalCount) / page_size
  );

  if (page_number < 1 || page_number > pagination_summary.total_pages) {
    res.status(400).send("Invalid page number");
    return;
  }

  pagination_summary.page_size = page_size;
  pagination_summary.total_entries = proposalCount;
  resData.pagination_summary = pagination_summary;

  [graphRes, states] = await Promise.all([
    axios.post(
      "https://api.thegraph.com/subgraphs/name/arr00/uniswap-governance-v2",
      {
        query:
          `{
          proposals(first:` +
          page_size +
          ` skip:` +
          offset +
          ` orderBy:startBlock orderDirection:desc) {
            id
            description
            creationTime
            startBlock
            endBlock
            executionTime
            cancellationTime
            executionETA
          }
        }`,
      }
    ),
    multicall.methods
      .aggregate(
        genCalls(
          GOVERNANCE_ADDRESS_ALPHA1,
          "0x3e4f49e6",
          offset + 1,
          offset + page_size > proposalCountDeprecated1
            ? proposalCountDeprecated1
            : offset + page_size,
          web3
        ).concat(
          genCalls(
            GOVERNANCE_ADDRESS_ALPHA2,
            "0x3e4f49e6",
            offset + 1 - proposalCountDeprecated1 > 1
              ? offset + 1 - proposalCountDeprecated1
              : 1,
            offset + page_size - proposalCountDeprecated1 >
              proposalCountDeprecated2
              ? proposalCountDeprecated2
              : offset + page_size - proposalCountDeprecated1,
            web3
          ).concat(
            genCalls(
              GOVERNANCE_ADDRESS_BRAVO,
              "0x3e4f49e6",
              offset +
                1 +
                (proposalCountDeprecated1 + proposalCountDeprecated2) >
                8
                ? offset +
                    1 +
                    (proposalCountDeprecated1 + proposalCountDeprecated2)
                : 8,
              offset +
                page_size +
                (proposalCountDeprecated1 + proposalCountDeprecated2) >
                proposalCount
                ? proposalCount
                : offset +
                    page_size +
                    (proposalCountDeprecated1 + proposalCountDeprecated2)
            )
          )
        )
      )
      .call(),
  ]);
  let stringStates = [];
  for (const state of states["returnData"]) {
    stringStates.push(statesKey[Number(state[state.length - 1])]);
  }
  console.log(stringStates);
  let proposalData = [];
  for (const proposal of graphRes.data.data.proposals) {
    let newProposal = {};
    newProposal.title = proposal.description.split("\n")[0].substring(2);
    newProposal.id = proposal.id;

    const currentState = stringStates.pop();
    let time = null;
    if (get_state_times == "true" || get_state_times == true) {
      time = await getTimeFromState(currentState, proposal, web3);
    }
    let stateObj = { value: currentState, start_time: time };

    newProposal.state = stateObj;
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
  return res;
}

async function getTimeFromState(state, proposal, web3) {
  let blockToFetch;
  let time = null;

  switch (state) {
    case "Pending":
      time = parseInt(proposal.creationTime);
      break;
    case "Active":
      blockToFetch = proposal.startBlock;
      break;
    case "Canceled":
      time = parseInt(proposal.cancellationTime);
      break;
    case "Defeated":
      blockToFetch = proposal.endBlock;
      break;
    case "Succeeded":
      blockToFetch = proposal.endBlock;
      break;
    case "Queued":
      time = parseInt(proposal.executionET) - 60 * 60 * 24 * 2; // two days
      break;
    case "Expired":
      time = parseInt(proposal.executionETA) + 1209600; // Grace period of 2 weeks
      break;
    case "Executed":
      time = parseInt(proposal.executionTime);
      break;
    default:
      console.log("fatal error");
      console.log("state is " + state);
  }

  if (time == null) {
    const block = await web3.eth.getBlock(blockToFetch);
    return block.timestamp;
  }

  return time;
}
