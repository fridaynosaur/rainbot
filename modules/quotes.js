/**
 * Some random quotes
 */

/* jslint node: true */
/* global BOT_DIR, LIBS_DIR, MODULES_DIR */
'use strict';

var quotes = [
	"I could clear the sky in 10 seconds flat!",
	"Are you a SPY?",
	"All the ponies in this town are CRAZY!",
	"Scarf? Check. Saddle? Check. Boots? Check. 'Spike refusing to get up and go back to sleep'? Check. It's a good thing I'm so organized. I'm ready!",
	"You've got a real problem all right, and a banjo is the only answer!",
	"You look like you'd be good at eating cupcakes!",
	"Well, well, well. It seems we have some 'neigh-sayers' in the audience.",
	"Beware! Beware you pony folk! Those leaves of blue are not a joke!",
	"I love fun things!",
	"*squeak*",
	"Whining? I am not \"whining\". I am complaining. Do you want to hear \"whining\"? *(whines obnoxiously)* This is whining! Ooohhhh! This harness is too tight! It's going to chafe! Can't you loosen it?! OH! It hurts and it's so rusty! Why didn't you clean it first?! It's gonna leave a stain, and the wagon's getting heavy! Why do I have to pull it?!",
	"FOREVER!!!",
	"It's no use. No matter what we try we always end up without our cutie marks; and surprisingly often covered in tree sap.",
	"I'm just glad I haven't been replaced by a bucket of turnips.",
	"Secrets and lies! It's all secrets and lies with those ponies!",
	"*angrily* You're... GOING TO LOVE ME!!!",
	"What fun is there in making sense?",
	"Hold on a second! Eternal chaos comes with chocolate rain, guys! Chocolate rain!",
	"Get back! All of you! This is my book. And I'm going to READ IT!",
	"I never thought it would happen. My friends... have turned into complete JERKS!",
	"Out of all things that could happen, this is THE! WORST! POSSIBLE! THING!",
	"I really like her... mane?",
	"Too old for free candy?! NEVER!",
	"I'm going to do what I do best: lecture her!",
	"Ha, ha! The fun has been doubled!",
	"I never leave home without my party cannon!",
	"I'm not giving him cake! I'm ASSAULTING him with cake!",
	"Hold on to your hooves, I'm about to be BRILLIANT!",
	"I just don't know what went wrong!",
	"*sadly* I'm the monster.",
	"And that's how Equestria was made!",
	"It needs to be about 20% cooler.",
	"Forgive me if I withhold my enthusiasm!",
	"Oatmeal!? Are you crazy?",
	"The Great & Powerful Trixie doesn't trust wheels.",
	"You even look good when you're chewing! Who looks good when they're chewing?",
	"You ruined my horn!!",
	"Don't you use your fancy mathematics to muddy the issue!",
	"Cross my heart and hope to fly, stick a cupcake in my eye!",
	"Twilight, you shouldn't hit the books, you should just read them.",
	"I'd like to be a tree.",
	"Whoa ho there, loverboy!",
	"Okie Dokie Lokie",
	"Huh. You may have vanquished an Ursa Minor, but you will never have the amazing, show-stopping ability of the Great and Powerful Trixie!",
	"Can you do that? Can you explode twice?",
	"Somepony needs to put this thing out of its misery.",
	"Necklace. Necklace. Necklace. Necklace. AND... BIG Crown thingy!",
	"Dumb Rock",
	"I don't wanna talk about it.",
	"Alright Applejack. Your applebucking hasn’t just caused you problems, its overpropelled pegasus, practically poisoned plenty of ponies, and terrorized bushels of brand new bouncing baby bunnies.",
	"Oh well, if anyone needs me I'll be outside in the chocolate puddles with a giant swizzle straw.",
	"I know where you live.",
	"Don't call me things I don't know what they mean!",
	"I thought we agreed to never speak of it.",
	"Can I have more of that mushy stuff? Whatever it was?",
	"Scoot-scootalooooooo!",
	"It was under EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE",
	"Who?",
	"Eeyup.",
	"Yay!",
	"Hmm, nah",
	"If I can't find a problem I am going to have to make one.",
	"This may look like fun, but it's NOT."];

function quote(source) {
	source.respond(quotes[Math.floor(Math.random() * quotes.length)]);
}

exports.init = function() {
	this.addCommand('quote', quote).addCommand('quotes', quote).addCommand('q', quote);
	this.addAction('quote', quote, /^(quotes|quote|q)$/i, false);
};