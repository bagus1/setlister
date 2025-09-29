




% lets emit the definitions

% end verbatim - this comment is a hack to prevent texinfo.tex
% from choking on non-European UTF-8 subsets

% this version tag will keep me compiling only on this version of lilypond.
%=====================================================================

\version "2.24.4"

% lets define a variable to hold the formatted build date (man 3 strftime):
%date=#(strftime "%T %d-%m-%Y" (localtime (current-time)))
%lilypond_version=#(lilypond-version)

% setting instruments for midi generation (bah - this doesn't work...)
%=====================================================================
%\set ChordNames.midiInstrument = #"acoustic grand"
%\set Staff.midiInstrument = #"flute"
%\set PianoStaff.instrumentName = #"acoustic grand"
% do not show chords unless they change...
%\set chordChanges = ##t

% number of staffs per page (this does not work because of my breaks)
%\paper {
%	system-count = #7
%}

\paper {
	% reduce spaces between systems and the bottom (taken from the lilypond
	% documentation and found the relevant variable)
	% the result of this is that I can fit 8 single staffs in one page
	% which is ideal for Jazz (think 32 bar divided into 8 lines of 4 bars each...).
	% I should really only apply this thing for Jazz tunes but that is a TODO item.
	% default is 4\mm - 3 already causes 8 staffs to take 2 pages
	between-system-padding = 2\mm
	% default is 20\mm
	% between-system-space = 16\mm
	% ragged-last-bottom = ##f
	% ragged-bottom = ##f

	% make lilypond increase the distance of the footer from the bottom of the page
	% it seems that if you don't do something like this you're going to have
	% a real problem seeing the footer in postscript printing....
	%bottom-margin = 2.5\cm

	% from /usr/share/lilypond/2.12.3/ly/titling-init.ly
	% to stop lilypond from printing footers...
	oddFooterMarkup = \markup {}

	% prevent lilypond from printing the headers...

	scoreTitleMarkup = \markup {}
	bookTitleMarkup = \markup {}
}
\layout {
	% don't have the first line indented
	indent = 0.0 \cm
	% don't know what this is (taken from Laurent Martelli...)
	%textheight = 1.5\cm

	\context {
		\Score
		% change the size of the text fonts
		%\override LyricText #'font-family = #'typewriter
		\override LyricText #'font-size = #'-2

		% set the style of the chords to Jazz - I don't see this making any effect
		\override ChordName #'style = #'jazz
		%\override ChordName #'word-space = #2

		% set the chord size and font
		%\override ChordName #'font-series = #'bold
		%\override ChordName #'font-family = #'roman
		%\override ChordName #'font-size = #-1

		% don't show bar numbers (for jazz it makes it too cluttery)
		\remove "Bar_number_engraver"
	}
}
% reduce the font size (taken from the lilypond info documentation, default is 20)
#(set-global-staff-size 17.82)

% There is no need to set the paper size to a4 since it is the default.
% make lilypond use paper of size a4 (Is this the default ?!?)
%#(set-default-paper-size "a4")
%)

% Don't have textedit:// links for every note in the pdf file.
% This reduces the size of the pdf by a lot
\pointAndClickOff

% chord related matters
myChordDefinitions={
	<c ees ges bes des' fes' aes'>-\markup \super {7alt}
	<c e g bes f'>-\markup \super {7sus}
	<c e g bes d f'>-\markup \super {9sus}
	<c e g f'>-\markup \super {sus}
	<c ees ges bes>-\markup { "m" \super { "7 " \flat "5" } }
	<c ees ges beses>-\markup { "dim" \super { "7" } }
	<c ees ges>-\markup { "dim" }
	%<c e g b>-\markup { "maj7" }
	<c e gis bes d'>-\markup { \super { "9 " \sharp "5" } }
	<c e g bes d' a'>-\markup \super {13}
	<c e g bes d' fis'>-\markup { \super { "9 " \sharp "11" } }
}
myChordExceptions=#(append
	(sequential-music-to-chord-exceptions myChordDefinitions #t)
	ignatzekExceptions
)

% some macros to be reused all over
% =====================================================================
myBreak=\break
% do line breaks really matter?
myEndLine=\break
%myEndLine={}
myEndLineVoltaNotLast={}
myEndLineVoltaLast=\break
myEndLineVolta=\break
partBar=\bar "||"
endBar=\bar "|."
startBar=\bar ".|"
startRepeat=\bar "|:"
endRepeat=\bar ":|"
startTune={}
endTune=\bar "|."
myFakeEndLine={}
mySegno=\mark \markup { \musicglyph #"scripts.segno" }
myCoda=\mark \markup { \musicglyph #"scripts.coda" }

% some functions to be reused all over
% =====================================================================
% A wrapper for section markers that allows us to control their formatting

% You can have a circle instead of a box using:
% \mark \markup { \circle #mark }
myMark =
#(define-music-function
	(parser location mark)
	(markup?)
	#{
	\mark \markup { \box #mark }
	#})
myWordMark =
#(define-music-function
	(parser location mark)
	(markup?)
	#{
	\mark \markup { \box #mark }
	#})
% grace that does appoggiatura
%\grace $notes
myGrace = #(define-music-function (parser location notes) (ly:music?) #{ \appoggiatura $notes #})
% grace that does nothing
%myGrace = #(define-music-function (parser location notes) (ly:music?) #{ #})

% this is a macro that * really * breaks lines. You don't really need this since a regular \break will work
% AS LONG AS you have the '\remove Bar_engraver' enabled...
hardBreak={ \bar "" \break }
% a macro to make vertical space
verticalSpace=\markup { \null }

% macros to help in parenthesizing chords
% see the playground area for openbook and http://lilypond.1069038.n5.nabble.com/Parenthesizing-chord-names-td44370.html
#(define (left-parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ("(" (ignatzek-chord-names in-pitches bass inversion context))))
#(define (right-parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ((ignatzek-chord-names in-pitches bass inversion context) ")")))
#(define (parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ("(" (ignatzek-chord-names in-pitches bass inversion context) ")")))
LPC = { \once \set chordNameFunction = #left-parenthesis-ignatzek-chord-names }
RPC = { \once \set chordNameFunction = #right-parenthesis-ignatzek-chord-names }
OPC = { \once \set chordNameFunction = #parenthesis-ignatzek-chord-names }

% some macros for marking parts of jazz tunes
% =====================================================================
startSong={}
% If we want endings of parts to be denoted by anything we need
% to find a smarter function that this since this will tend
% to make other things disapper (repeat markings etc)
%endSong=\bar "|."
endSong={}
startPart={}
% If we want endings of parts to be denoted by anything we need
% to find a smarter function that this since this will tend
% to make other things disapper (repeat markings etc)
% endPart=\bar "||"
endPart={}
startChords={
	% this causes chords that do not change to disappear...
	\set chordChanges = ##t
	% use my own chord exceptions
	\set chordNameExceptions = #myChordExceptions
}
endChords={}


% lets always include guitar definitions
\include "predefined-guitar-fretboards.ly"



% from here everything needs to go into a loop

% include anything the user wants before the bookpart starts









% this causes the variables to be defined...













% now play with the variables that depend on language



% calculate the tag line


% calculate the typesetby









% taken from "/usr/share/lilypond/2.12.3/ly/titling-init.ly"
\markup {
	\column {
		\override #'(baseline-skip . 3.5)
		\column {
			\huge \larger \bold
			\fill-line { \larger "I Got Plenty O' Nuttin'" }
			\fill-line { \large \smaller \bold \larger "From 'Porgy and Bess'" }
			\fill-line {
				"Lyrics by Ira Gershwin, DuBose Heyward"
				"Music by George Gershwin"
			}
			\fill-line {
				"Moderately"
				""
			}
		}
	}
}
\noPageBreak


% include the preparatory stuff, if there is any

% calculate the vars



% score for printing
\score {
	<<
\new ChordNames="Chords"
	\with {
		\remove "Bar_engraver"
	}
% # transpose with 'inline' is true!
	\transpose c c {


\chordmode {
	\startChords
	\startSong

	\partial 4 s4 |

	\repeat volta 2 {

		\myMark "A"
		\startPart
		g2 a:m7 | b:m a:m7 | g a:m7 | g b:7 | e a | \myEndLine
		e a | e a4 e | cis1 | cis2 d | \myEndLine
		\endPart

		\myMark "A"
		\startPart
		g2 a:m7 | b:m a:m7 | g a:m7 | g b:7 | e a | \myEndLine
		e a | e a4 e | cis1 | cis2 d | g2 a:m7 | b:m g | \myEndLine
		\endPart

		\myMark "B"
		\startPart
		b:m e:m/b | b:m6 e:m/b | b:m e:m/b | b:m6 e:m/b | \myEndLine
		b:m e:m/b | b:m6 e:m/b | b:m a:m7 | d a:m7 | d1:7 | d:7 | \myEndLine
		\endPart

		\myMark "A'"
		\startPart
		g2 a:m7 | b:m a:m7 | g a:m7 | g b:7 | \myEndLine
		e a | e a | e a4 e | cis1 | cis | \myEndLine
		cis2 d | g a:m7 | g d:m7 | g a:m7 | \myEndLine
		g c |
	} \alternative {
		{
			g1 | g | b2:m a:m7 | \myEndLineVoltaNotLast
		}
		{
			g4 c2:7 d4:7 | g1 | \myEndLineVoltaLast
		}
	}
	\endPart

	\endSong
	\endChords
}



}
% this thing will only engrave voltas. This is required to put the volta under the chords.
% No great harm will happen if you don't put it, only the voltas will be above the chords.
%\new Staff \with {
%	\consists "Volta_engraver"
%}
\new Staff="Melody" {
\new Voice="Voice"
% # transpose with 'inline' is true!
	\transpose c c { \relative c'
	



{
	\tempo "Allegro" 4 = 130
	\time 2/2
	\key g \major

	\partial 4 d4 |

	\repeat volta 2 {

		% part "A"
		g4 g a g8 a | b8 d4.~ d4 r8 d, | b'4 b8 a~ a b a4 | g2 fis | e4 e cis4. r8 |
		e4 e cis4. cis8 | e4 e cis e | eis1~ | eis2 fis |

		% part "A"
		g4 g a g8 a | b8 d4.~ d4 r | b4 b8 a~ a b a4 | g2 fis | e4 e cis8 cis4 cis8 |
		e8 e4 e8 cis cis cis cis | e4 e cis e | eis1~ | eis2 fis | g1~ | g2 r |

		% part "B"
		fis4 d8 b d4 b8 d | fis2 e8 fis e b | d1~ | d4 r e8 fis e b |
		d4 b8 d fis2~ | fis e8 fis e b | d4 b8 d e4 c8 e | fis4 d8 fis g4 e8 g | a4 fis8 a c2~ | c r4 d, |

		% part "A"
		g g a g8 a | b8 d4.~ d4 r8 d, | b'4 b8 a~ a b a4 | g2 fis |
		e4 e cis4. r8 | e4 e cis4. cis8 | e e4 e8 cis4 e | eis1 | \xNote { \tuplet 3/2 { b'4 b b } g e } |
		r2 fis4 fis | g1~ | g4 r f f | g1~ |
		g4 r e4 e |
	} \alternative {
		{
			g1~ | g2 r | r1 |
		}
		{
			g1~ | g4 r r2 |
		}
	}
}


 }
}
\new Lyrics="Lyrics" \lyricsto "Voice" {
	




\lyricmode {

	% part "A"
	Oh, I Got Plen -- ty O' Nut -- tin', __ an' nut -- tin's plen -- ty fo' me. I got no car,
	got no mule, I got no mis -- er -- y. __ De

	% part "A"
	folks wid plen -- ty o' plen -- ty __ got a lock __ on de door, _
	faid some -- bod -- y's a go -- in' to rob 'em while dey's out a mak -- in' more. __
	What for? __

	% part "B"
	I got no lock on de door, (dat's no way to be.) __ Day kin steal de rug from de floor, __ dat's o -- keh wid
	me, 'cause de things dat I prize, like de stars in de skies, all are free. __

	% part "A"
	Oh, I Got Plen -- ty O' Nut -- tin; __
	an' nut -- tin's plen -- ty fo' me.
	I got a gal, got my song, got heb ben the whole day long.
	No use com -- plain -- in'! Got my gal, __ got my Lawd, __
	go my song. __
	song. __
}


}
\new Lyrics="Lyrics" \lyricsto "Voice" {
	





\lyricmode {

	% part "A"
	_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
	got the sun, got the moon, _ got the deep blue sea. __ De folks wid plen -- ty o' plen -- ty __
	got to pray __ all de day, _ __ Seems wid plen -- ty you sure got to wor -- ry how to
	keep the debbel a -- way, __ a -- way. __ I ain't a -- fret -- tin' 'bout
	hell 'til de time ar -- rive. __ Nev -- er wor -- ry long as I'm well, __ nev -- er one to strive to be good, to be bad, what the hell?
	I is glad I's a live. __
}

}
	>>
	\layout {
	}
}
% score for midi
\score {
	\unfoldRepeats
	<<
\new ChordNames="Chords"
	


\chordmode {
	\startChords
	\startSong

	\partial 4 s4 |

	\repeat volta 2 {

		\myMark "A"
		\startPart
		g2 a:m7 | b:m a:m7 | g a:m7 | g b:7 | e a | \myEndLine
		e a | e a4 e | cis1 | cis2 d | \myEndLine
		\endPart

		\myMark "A"
		\startPart
		g2 a:m7 | b:m a:m7 | g a:m7 | g b:7 | e a | \myEndLine
		e a | e a4 e | cis1 | cis2 d | g2 a:m7 | b:m g | \myEndLine
		\endPart

		\myMark "B"
		\startPart
		b:m e:m/b | b:m6 e:m/b | b:m e:m/b | b:m6 e:m/b | \myEndLine
		b:m e:m/b | b:m6 e:m/b | b:m a:m7 | d a:m7 | d1:7 | d:7 | \myEndLine
		\endPart

		\myMark "A'"
		\startPart
		g2 a:m7 | b:m a:m7 | g a:m7 | g b:7 | \myEndLine
		e a | e a | e a4 e | cis1 | cis | \myEndLine
		cis2 d | g a:m7 | g d:m7 | g a:m7 | \myEndLine
		g c |
	} \alternative {
		{
			g1 | g | b2:m a:m7 | \myEndLineVoltaNotLast
		}
		{
			g4 c2:7 d4:7 | g1 | \myEndLineVoltaLast
		}
	}
	\endPart

	\endSong
	\endChords
}




\new Staff="Melody" {
\new Voice="Voice"
	\relative c'
	



{
	\tempo "Allegro" 4 = 130
	\time 2/2
	\key g \major

	\partial 4 d4 |

	\repeat volta 2 {

		% part "A"
		g4 g a g8 a | b8 d4.~ d4 r8 d, | b'4 b8 a~ a b a4 | g2 fis | e4 e cis4. r8 |
		e4 e cis4. cis8 | e4 e cis e | eis1~ | eis2 fis |

		% part "A"
		g4 g a g8 a | b8 d4.~ d4 r | b4 b8 a~ a b a4 | g2 fis | e4 e cis8 cis4 cis8 |
		e8 e4 e8 cis cis cis cis | e4 e cis e | eis1~ | eis2 fis | g1~ | g2 r |

		% part "B"
		fis4 d8 b d4 b8 d | fis2 e8 fis e b | d1~ | d4 r e8 fis e b |
		d4 b8 d fis2~ | fis e8 fis e b | d4 b8 d e4 c8 e | fis4 d8 fis g4 e8 g | a4 fis8 a c2~ | c r4 d, |

		% part "A"
		g g a g8 a | b8 d4.~ d4 r8 d, | b'4 b8 a~ a b a4 | g2 fis |
		e4 e cis4. r8 | e4 e cis4. cis8 | e e4 e8 cis4 e | eis1 | \xNote { \tuplet 3/2 { b'4 b b } g e } |
		r2 fis4 fis | g1~ | g4 r f f | g1~ |
		g4 r e4 e |
	} \alternative {
		{
			g1~ | g2 r | r1 |
		}
		{
			g1~ | g4 r r2 |
		}
	}
}



}
	>>
	\midi {
	}
}


\noPageBreak
\markup \column {
	% just a little space
	\null
	\fill-line {
		\smaller \smaller { "Copyright © 1935 by Gershwin Publishing Corporation" }
	}
	\fill-line {
		\smaller \smaller { "Copyright Renewed, Assigned to Chappell & Co., Inc." }
	}

	\fill-line {
		\smaller \smaller { "Typeset by Jordan Eldredge <jordan@jordaneldredge.com>, Built at 17:52:17 28-09-2025, Engraved by lilypond 2.24.4" }
	}
	\fill-line {
		\smaller \smaller { \with-url #"https://veltzer.github.io/openbook" https://veltzer.github.io/openbook }
	}
}





