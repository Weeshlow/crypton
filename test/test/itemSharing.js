/* Crypton Server, Copyright 2015 SpiderOak, Inc.
 *
 * This file is part of Crypton Server.
 *
 * Crypton Server is free software: you can redistribute it and/or modify it
 * under the terms of the Affero GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or (at your
 * option) any later version.
 *
 * Crypton Server is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the Affero GNU General Public
 * License for more details.
 *
 * You should have received a copy of the Affero GNU General Public License
 * along with Crypton Server.  If not, see <http://www.gnu.org/licenses/>.
*/

describe('Item sharing tests', function () {
  this.timeout(200000);

  var alice, bob;
  var aliceSession, bobSession;
  var itemNameHmac;
  var item1;

  describe('Create Account', function () {
    it('Create Alice', function (done) {
      crypton.generateAccount('alice4', 'pass', function (err, acct) {
        if (err) throw err;
        assert(acct);
        alice = acct;
      });

      crypton.generateAccount('bob4', 'pass', function (err, acct) {
        if (err) throw err;
        assert(acct);
        bob = acct;
        done();
      });

    });

    it('Get Bob\'s session', function (done) {
      crypton.authorize('bob4', 'pass', function (err, sess) {
        if (err) throw err;
        bobSession = sess;
        assert(sess);
        bobSession.events['message'] = function (message) {
          console.log('message rcvd: ', message);
        };
        // trust alice
        bobSession.getPeer('alice4', function (err, peer) {
          if (err) { throw err };
          peer.trust(function (err) {
            if (err) throw err;
            assert(peer.trusted);
            // XXXddahl: need to clear out the entire message inbox

            done();
          });
        });
      });
    });

    it('Get Alice\'s session', function (done) {
      crypton.authorize('alice4', 'pass', function (err, sess) {
        if (err) throw err;
        aliceSession = sess;
        assert(sess);
        // trust bob
        aliceSession.getPeer('bob4', function (err, peer) {
          if (err) { throw err };
          peer.trust(function (err) {
            if (err) throw err;
            assert(peer.trusted);
            done();
          });
        });
      });
    });

    it('Create an Item', function (done) {
      aliceSession.getOrCreateItem('my-first-shared-item', function (err, item) {
        if (err) {
          console.error(err);
          throw (err);
        }
        item1 = item;
        assert(item);
        assert(item.sessionKey);
        assert(item.value);
        itemNameHmac = item.nameHmac;
        done();
      });
    });


    it('Update Item', function (done) {
      try {
        item1.value = { foo: 1, bar: 2, baz: 3 };
      } catch (ex) {
        console.error(ex);
        throw new Error(ex);
      }
      done();
    });

    it('share item with bob', function (done) {
      var bobPeer = aliceSession.peers.bob4;
      console.log('bobPeer: ', bobPeer.username);
      assert.equal(bobPeer.username, 'bob4');
      console.log('item1: ', item1.name);
      // assert(item1);
      item1.share(bobPeer, function (err) {
        if (err) throw err;
        assert.equal(null, err);
        console.log('\nitem1.shared: \n', item1.shared);
        done();
      });
    });

    // check item was shared
    it('check item was shared', function (done) {

      crypton.authorize('bob4', 'pass', function (err, sess) {
        if (err) throw err;
        bobSession = sess;
        assert(sess);
        bobSession.inbox.getAllMetadata(function (err, messageList) {
          console.log('messageList: ', messageList);
          assert.equal(messageList.length, 1);
          // Get and decrypt message:
          bobSession.inbox.get(messageList[0].messageId,
            function (err, message) {
              if (err) throw err;

              console.log('Message Keys: ', Object.keys(message));
              console.log('Message Headers Keys: ', Object.keys(message.headers));
              console.log('Message Payload Keys: ', Object.keys(message.payload));

              assert.equal(message.headers.notification, 'sharedItem');
              assert.equal(message.payload.from, 'alice4');
              assert.equal(message.payload.itemNameHmac, item1.nameHmac);
              assert(message.payload.sent);
              // Load the shared Item
              bobSession.getSharedItem(message.payload.itemNameHmac,
                bobSession.peers.alice4,
                function (err, item) {
                  if (err) throw err;
                  assert.equal(item.value.baz, 3);
                  done();
                });
            });
        });
      });
    });

  });
});