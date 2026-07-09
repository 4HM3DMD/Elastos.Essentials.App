/**
 * List of popular IPFS gateways that we want to replace with our preferred gateway instead.
 */
const IPFSGatewayPrefixesToReplace = ['https://gateway.pinata.cloud/ipfs', 'https://ipfs.io/ipfs'];

/**
 * If the url starts with ipfs, returns the gateway-accessible url.
 * Otherwise, returns the given url.
 */
export function replaceIPFSUrl(anyUrl: string): string {
  if (!anyUrl) return anyUrl;

  if (anyUrl.startsWith('ipfs')) {
    // Some token URI (rarible) use this format: ipfs://ipfs/abcde.
    // So we remove the duplicate ipfs/ as we are adding our own just after.
    anyUrl = anyUrl.replace('ipfs://ipfs/', 'ipfs://');

    return `https://ipfs.elastos.io/ipfs/${anyUrl.replace('ipfs://', '')}`;
  }

  // Replace IPFS gateways potentially harcoded by NFTs, with the ipfs.io gateway, to reduce
  // rate limiting api call errors (like on pinata).
  // NOTE: not working well, maybe IPFS hashes can't be fetched (eg getting a vitrim or bunny hash through ttech.io gateway often times out)
  for (let gateway of IPFSGatewayPrefixesToReplace) {
    if (anyUrl.startsWith(gateway)) {
      anyUrl = anyUrl.replace(gateway, 'https://ipfs.elastos.io/ipfs');
      break; // Don't search further
    }
  }

  return anyUrl;
}
