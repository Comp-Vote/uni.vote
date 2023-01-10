import axios from "axios"; // Axios requests

export default async (req, res) => {
  // pagination logic
  let { page_number = 1, page_size = 10 } = req.query;
  page_number = Number(page_number);
  page_size = Number(page_size);
  const offset = (page_number - 1) * page_size;
  const total_pages = Math.ceil(2000 / page_size);
  let pagination_summary = { total_pages, page_size, page_number };
  if (
    pagination_summary.page_number < 1 ||
    pagination_summary.page_number > pagination_summary.total_pages
  ) {
    res.status(400).send("Invalid page number");
    return;
  }

  // Fetch top delegates from tally
  const tallyRes = await axios.post("https://api.tally.xyz/query", {
    query: `query GovernanceTopVoters($governanceId: AccountID!, $pagination: Pagination) {
          governance(id: $governanceId) {
            delegates(pagination: $pagination) {
              account {
                name
                picture
                address
                identities {
                  twitter
                }
              }
              participation {
                stats {
                  votes {
                    total
                  }
                  weight {
                    total
                  }
                }
              }
            }
          }
        }`,
    variables: {
      governanceId: "eip155:1:0x408ED6354d4973f66138C91495F2f2FCbd8724C3",
      pagination: {
        limit: page_size,
        offset,
      },
    },
    headers: {
      "Api-Key": process.env.TALLY_API_KEY,
    }
  });

  const accounts = tallyRes.data.data.governance.delegates;

  for (const x in accounts) {
    let a = accounts[x];
    console.log(a);
    a.address = a.account.address;
    a.proposals_voted = a.participation.stats.votes.total;
    a.votes = a.participation.stats.weight.total / 1e18;
    a.image_url = a.account.picture;
    a.display_name = a.account.name;
    a.twitter = a.account.identities.twitter;
    delete a.account;
    delete a.participation;

    accounts[x] = a;
    accounts[x]["rank"] = Number(x) + offset + 1;
  }

  let resData = { accounts, pagination_summary };
  res.json(resData);
};
