'use strict';

// RPA-138, with the core of RPA-136. One JSON document per plan, written
// whole or not at all: a write that fails leaves the document before it
// intact. A replacement names the version it read. Writes for one plan are
// serialised, then the stored version is checked again immediately before
// replacement, so two requests that read the same version cannot both win.
// A future durable store must provide the same conditional-write contract
// atomically at its shared destination.
//
// A local directory is the first destination, not the last: Render's disk
// forgets on redeploy, which is the same problem the feedback file has, and
// is why nothing here is enabled by default. The interface is three methods,
// so the durable store this becomes can be swapped in without the routes
// noticing.

const MAX_RECORD_BYTES = 512 * 1024;
const ID = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,63}$/;

class VersionConflictError extends Error {
  constructor(version) {
    super('The plan changed before this write could be kept.');
    this.name = 'VersionConflictError';
    this.code = 'VERSION_CONFLICT';
    this.version = version;
  }
}

function createPlanStore({ dir, fs = require('fs'), path = require('path') }) {
  if (typeof dir !== 'string' || !dir) throw new Error('A directory for plan records is required.');
  const planLocks = new Map();
  const fileFor = (id) => {
    if (!ID.test(id)) throw new Error('Invalid plan id.');
    return path.join(dir, id + '.json');
  };
  const read = async (id) => {
    let text;
    try {
      text = await fs.promises.readFile(fileFor(id), 'utf8');
    } catch (err) {
      if (err && err.code === 'ENOENT') return null;
      throw err;
    }
    const record = JSON.parse(text);
    return record && typeof record === 'object' && !Array.isArray(record) ? record : null;
  };
  const withPlanLock = async (id, task) => {
    const previous = planLocks.get(id) || Promise.resolve();
    let release;
    const current = new Promise((resolve) => { release = resolve; });
    planLocks.set(id, current);
    await previous;
    try {
      return await task();
    } finally {
      release();
      if (planLocks.get(id) === current) planLocks.delete(id);
    }
  };
  return {
    read,
    // Written to a neighbouring name and moved into place, so a reader never
    // sees half a record and a failure never destroys the one before it. When
    // expectedVersion is supplied, replacing any other version is refused.
    async write(id, record, options = {}) {
      const text = JSON.stringify(record);
      if (Buffer.byteLength(text) > MAX_RECORD_BYTES) throw new Error('This plan is too large to keep.');
      const target = fileFor(id);
      const staging = target + '.' + process.pid + '.tmp';
      return withPlanLock(id, async () => {
        if (Object.prototype.hasOwnProperty.call(options, 'expectedVersion')) {
          const current = await read(id);
          const version = current && Number.isInteger(current.version) ? current.version : null;
          if (version !== options.expectedVersion) throw new VersionConflictError(version);
        }
        await fs.promises.mkdir(dir, { recursive: true });
        try {
          await fs.promises.writeFile(staging, text);
          await fs.promises.rename(staging, target);
        } catch (err) {
          try { await fs.promises.unlink(staging); } catch (ignored) { /* nothing to clean up */ }
          throw err;
        }
      });
    },
  };
}

module.exports = { createPlanStore, VersionConflictError, MAX_RECORD_BYTES, ID };
