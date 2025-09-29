




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
			\fill-line { \larger "They All Laughed" }
			\fill-line {
				"Lyrics by Ira Gershwin"
				"Music by George Gershwin"
			}
			\fill-line {
				"Medium Swing"
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

	\repeat volta 2 {

		\myMark "A"
		\startPart
		g2 e:m | a:m7 d:7 | a:m7 d:7.9- | g4 bes:7 a:7 d:7 | \myEndLine
		g2 e:m | a:m7 d:7 | g:6 e:m7 | a:m7 d:7 | \myEndLine
		\endPart

		\myMark "A'"
		\startPart
		g2 e:m | a:m7 d:7 | cis:7.9- fis:7.9- | b:m7 e:7 | \myEndLine
		d1:6 | a:7 | d1*2:7 | \myEndLine
		\endPart

		\myMark "B"
		\startPart
		g4*11:7 b4:7 | e1:7.5+ | \myEndLine
		a1*2:7 | a1:m7 | ees2:7 d2:7 | \myEndLine
		\endPart

		\myMark "A''"
		\startPart
		g2 e:m | a:m7 d:7 | b:7 e:7 | a1:7 | \myEndLine
		g2 e:7 | a:m7 d:7 |

	} \alternative {
		{
			g e:7.9+ | a:7.9- d:7.9- | \myEndLineVoltaNotLast
		}
		{
			ees1 | bes2/d d:7/c | g/b e:7 | a:m7 d:7 | g1*2 | \myEndLineVoltaLast
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

	\repeat volta 2 {

		% part "A"
		r8 d e4 g a | b8.[ b16 a8. g16] a8 b4. | b8.[ b16 a8. g16] a8 b4 d,8~ | d1 |
		r8 d e4 g a | b8.[ b16 a8. g16] a8 b4 g8~ | g1~ | g2. r4 |

		% part "A"
		r8 d e4 g a | b8.[ b16 a8. g16] a8 b4. | d8.[ d16 cis8. b16] cis8 d4 fis,8~ | fis1 |
		b4 a8. gis16 a8 b4. | b8.[ c16 a8. gis16] a8 b4. | a4 b c b | a d d d |

		% part "B"
		d2~ d8 b4 g8 | a2~ a8.[ b16 c8. cis16] | d4 e d b | c2. b4 |
		e2~ e8 cis4 a8 | b2~ b8 a4 b8 | c4 e e, g | a1 |

		% part "A"
		r8 d, e4 g a | b8.[ b16 a8. g16] a8 b4. | c8 b4 a8 b4 c | b2. a4 |
		d4 d d2 | e8 e4 e8 b4 b |
	} \alternative {
		{
			g1~ | g2 r |
		}
		{
			g4 g g2 | bes8 bes4 bes8 fis4 fis | d'4 d d2 | e8 e4 e8 b4 b | g1~ | g4 r r2 |
		}
	}
}


 }
}
\new Lyrics="Lyrics" \lyricsto "Voice" {
	




\lyricmode {

	% part "A"
	They All Laughed at Chris -- to -- pher Co -- lum -- bus
	when he said the world was round. __
	They All Laughed when Ed -- i -- son re -- cord -- ed sound. __

	% part "A"
	They All Laughed at Wil -- bur and his broth -- er,
	when they said that man could fly. __
	They told Mar -- co -- ni wire -- less was a pho -- ney;
	it's the same old cry.

	% part "B"
	They laughed at me __ want -- ing you, __
	said I was reach -- ing for the moon.
	But oh, __ you came through __
	now they'll have to change their tune.

	% part "A"
	They all said we nev -- er could be hap -- py,
	they laughed at us and how!
	But ho, ho, ho!
	Who's got the last laugh now? __

	% part "Volta"
	He, he, he!
	Let's at the past laugh,
	Ha, ha, ha!
	Who's got the last laugh now? __
}


}
\new Lyrics="Lyrics" \lyricsto "Voice" {
	





\lyricmode {

	% part "A"
	They All Laughed at Rock -- e -- fel -- ler Cen -- ter,
	now they're fight -- ing to get in. __
	They All Laughed at Whit -- ney and his cot -- ton gin. __

	% part "A"
	They All Laughed at Ful -- ton and his steam -- boat,
	Her -- shey and his choc' -- late bar. __
	Ford and his Liz -- zie kept the laugh -- ers bus -- y;
	that's how peo -- ple are.

	% part "B"
	They laughed at me __ want -- ing you, __
	said it would be hel -- lo, good -- bye.
	But oh, __ you came through __
	now they're eat -- ing hum -- ble pie.

	% part "A"
	They all said we'd nev -- er get to -- geth -- er;
	dar -- ling, let's take a bow.
	For ho, ho, ho!
	Who's got the last laugh
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

	\repeat volta 2 {

		\myMark "A"
		\startPart
		g2 e:m | a:m7 d:7 | a:m7 d:7.9- | g4 bes:7 a:7 d:7 | \myEndLine
		g2 e:m | a:m7 d:7 | g:6 e:m7 | a:m7 d:7 | \myEndLine
		\endPart

		\myMark "A'"
		\startPart
		g2 e:m | a:m7 d:7 | cis:7.9- fis:7.9- | b:m7 e:7 | \myEndLine
		d1:6 | a:7 | d1*2:7 | \myEndLine
		\endPart

		\myMark "B"
		\startPart
		g4*11:7 b4:7 | e1:7.5+ | \myEndLine
		a1*2:7 | a1:m7 | ees2:7 d2:7 | \myEndLine
		\endPart

		\myMark "A''"
		\startPart
		g2 e:m | a:m7 d:7 | b:7 e:7 | a1:7 | \myEndLine
		g2 e:7 | a:m7 d:7 |

	} \alternative {
		{
			g e:7.9+ | a:7.9- d:7.9- | \myEndLineVoltaNotLast
		}
		{
			ees1 | bes2/d d:7/c | g/b e:7 | a:m7 d:7 | g1*2 | \myEndLineVoltaLast
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

	\repeat volta 2 {

		% part "A"
		r8 d e4 g a | b8.[ b16 a8. g16] a8 b4. | b8.[ b16 a8. g16] a8 b4 d,8~ | d1 |
		r8 d e4 g a | b8.[ b16 a8. g16] a8 b4 g8~ | g1~ | g2. r4 |

		% part "A"
		r8 d e4 g a | b8.[ b16 a8. g16] a8 b4. | d8.[ d16 cis8. b16] cis8 d4 fis,8~ | fis1 |
		b4 a8. gis16 a8 b4. | b8.[ c16 a8. gis16] a8 b4. | a4 b c b | a d d d |

		% part "B"
		d2~ d8 b4 g8 | a2~ a8.[ b16 c8. cis16] | d4 e d b | c2. b4 |
		e2~ e8 cis4 a8 | b2~ b8 a4 b8 | c4 e e, g | a1 |

		% part "A"
		r8 d, e4 g a | b8.[ b16 a8. g16] a8 b4. | c8 b4 a8 b4 c | b2. a4 |
		d4 d d2 | e8 e4 e8 b4 b |
	} \alternative {
		{
			g1~ | g2 r |
		}
		{
			g4 g g2 | bes8 bes4 bes8 fis4 fis | d'4 d d2 | e8 e4 e8 b4 b | g1~ | g4 r r2 |
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
		\smaller \smaller { "Copyright © 1937, Gershwin Publishing Corporation" }
	}
	\fill-line {
		\smaller \smaller { "Copyright Renewed, Assigned to Chappell & Co, Inc." }
	}

	\fill-line {
		\smaller \smaller { "Typeset by Mark Veltzer <mark.veltzer@gmail.com>, Built at 17:52:07 28-09-2025, Engraved by lilypond 2.24.4" }
	}
	\fill-line {
		\smaller \smaller { \with-url #"https://veltzer.github.io/openbook" https://veltzer.github.io/openbook }
	}
}





