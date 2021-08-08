 db.system.js.insertOne(
    {
      _id: "reserveSeats",
      value : function (tripId,seats){
        var tripId = tripId;
        var seats = seats;
        db.Carts.insert({"_id":getNextSequenceValue("cartId") });
        var cartId = db.Carts.find().sort({"_id" : -1}).limit(1)[0]._id;
        var seatsQuery = [];
        var setSeatsSelection = {};
        var trip = db.Trips.findOne({_id: tripId});
        for(var i = 0; i < seats.length; i++) {
            var seatSelector = {};
            var seatSelection="seats."+seats[i][0]+"."+seats[i][1];
            seatSelector[seatSelection]=0;
            seatsQuery.push(seatSelector);setSeatsSelection[seatSelection] = 1;
        }
        var result = db.Trips.update(
            {_id: tripId, 
            $and: seatsQuery}, 
            {$push: {reservations: {
                _id: cartId, 
                seats: seats, 
                price: trip.price, 
                total: trip.price * seats.length}
            },
            $set: setSeatsSelection, 
            $inc: { seatsAvailable: -seats.length }            
         });
         
        if(result.nModified == 0){
            print("Could not reserve seats")};
        if(result.nModified == 1){
            var seatsQuery = [];
            var setSeatsSelection = {};
            var cart_result = db.Carts.update(
                {_id: cartId},
                { $push:{reservations:{
                    tripId: tripId, 
                    seats: seats, 
                    price: trip.price,
                    total: trip.price * seats.length}
                },$inc: {total: trip.price * seats.length }, 
                $set: { modifiedOn: new Date() }
            });
            
            if(cart_result.nModified == 1){
                print("Successfully added reservation to cart"); 
                var cart = db.Carts.findOne({_id: cartId}); 
                db.TicketReceipts.insert(
                    {createdOn: new Date(),
                    reservations: cart.reservations, 
                    total: cart.total
                }); 
                    
                db.Trips.update(
                    {'reservations._id': cartId}, 
                    {$pull: { reservations: { _id: cartId }
                 }}, false, true); 
                 
                db.Carts.update(
                    { _id: cartId}, 
                    {$set: { state: 'done' }
                });}
                
            if(cart_result.nModified == 0){
                print("Failed to add reservation to cart");
                var setSeatsSelection = {}; 
                for(var i = 0; i < seats.length; i++)
                    {setSeatsSelection['seats.' + seats[i][0] + '.' + seats[i][1]] = 0;
                }
                var failed_result = db.Trips.update(
                    {_id: tripId}, 
                    {$set: setSeatsSelection, 
                    $pull: { reservations: { _id: cartId } }
                }); 
                
                if(failed_result.nModified == 0){
                    print("Failed to release reservation");
                }
                if(failed_result.nModified == 1){
                    print("Succeded in releasing reservation");
                }
            }
        };
    }}
 );

 db.system.js.insertOne(
    {
      _id: "getNextSequenceValue",
      value : function (sequenceName){
        var sequenceDocument = db.cartCounters.findAndModify({
           query:{_id: sequenceName },
           update: {$inc:{sequence_value:1}},
           new:true
        });
        return sequenceDocument.sequence_value;
     }
    }
 );

 db.system.js.insertOne(
    {
      _id: "expireCarts",
      value : function (){
        var cutOffDate = new Date(); 
        cutOffDate.setMinutes(cutOffDate.getMinutes() - 10);

        var carts = db.Carts.find({
            modifiedOn: { $lte: cutOffDate }, state: 'active'
          });

        // Process all carts
        while(carts.hasNext()) {
            var cart = carts.next();
        
            // Process all reservations in the cart
            for(var i = 0; i < cart.reservations.length; i++) {
            var reservation = cart.reservations[i];
            var seats = reservation.seats;
            var setSeatsSelection = {};
        
            for(var i = 0; i < seats.length; i++) {
                setSeatsSelection['seats.' + seats[i][0] + '.' + seats[i][1]] = 0;
            }
        
            // Release seats and remove reservation
            db.Trips.update({
                _id: reservation._id
            }, {
                $set: setSeatsSelection
                , $pull: { reservations: { _id: cart._id }}
            });
            }
        // Set the cart to expired
        db.Carts.update({
            _id: cart._id
        }, {
            $set: { status: 'expired' }
        });    
     }
    }
});


